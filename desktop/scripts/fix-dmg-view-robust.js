#!/usr/bin/env node
/**
 * Robust script to fix DMG Finder view settings
 * This script manually writes view settings to the DMG's .DS_Store file
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const releaseDir = join(__dirname, '../release');

// Find the most recent DMG file
let dmgFile = null;
try {
  const files = readdirSync(releaseDir)
    .filter(f => f.endsWith('.dmg') && !f.endsWith('.blockmap'))
    .map(f => ({
      name: f,
      path: join(releaseDir, f),
      time: statSync(join(releaseDir, f)).mtime
    }))
    .sort((a, b) => b.time - a.time);
  
  if (files.length > 0) {
    dmgFile = files[0].path;
    console.log(`Found DMG: ${files[0].name}`);
  }
} catch (err) {
  console.log('No DMG files found or release directory does not exist');
  process.exit(0);
}

if (!dmgFile) {
  console.log('No DMG file to fix');
  process.exit(0);
}

async function fixDMGView() {
  console.log('Fixing DMG view settings (robust method)...');

  let volumePath = null;
  let needsDetach = false;

  try {
    // Check if already mounted
    const volumes = execSync('ls /Volumes/', { encoding: 'utf8' }).split('\n').filter(v => v.trim());
    const existingVolume = volumes.find(v => v.includes('Himalayan'));
    
    if (existingVolume) {
      volumePath = `/Volumes/${existingVolume}`;
      console.log(`Volume already mounted at: ${volumePath}`);
    } else {
      // Mount the DMG
      console.log('Mounting DMG...');
      execSync(`hdiutil attach "${dmgFile}" -readonly -noverify -noautoopen -nobrowse`, {
        encoding: 'utf8',
        stdio: 'ignore'
      });
      
      // Wait for mount
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newVolumes = execSync('ls /Volumes/', { encoding: 'utf8' }).split('\n').filter(v => v.trim());
      const newVolume = newVolumes.find(v => v.includes('Himalayan'));
      if (newVolume) {
        volumePath = `/Volumes/${newVolume}`;
        needsDetach = true;
        console.log(`Mounted at: ${volumePath}`);
      } else {
        throw new Error('Could not find mounted volume');
      }
    }
    
    const volumeName = volumePath.split('/').pop();
    
    // Use AppleScript to open, configure, and save view settings
    const script = `
      tell application "Finder"
        activate
        try
          set theVolume to disk "${volumeName}"
          set theWindow to open theVolume
          
          -- Wait for window to open
          delay 0.5
          
          -- Set view to icon view
          set current view of theWindow to icon view
          set toolbar visible of theWindow to false
          set statusbar visible of theWindow to false
          set bounds of theWindow to {400, 100, 940, 480}
          
          -- Configure icon view options
          set theOptions to icon view options of theWindow
          set arrangement of theOptions to not arranged
          set icon size of theOptions to 72
          set text size of theOptions to 12
          set label position of theOptions to bottom
          set shows item info of theOptions to false
          set shows icon preview of theOptions to true
          
          -- Position icons explicitly
          try
            set appItem to item "Himalayan Game Builder.app" of theVolume
            set position of appItem to {130, 220}
          end try
          
          try
            set appsLink to item "Applications" of theVolume
            set position of appsLink to {410, 220}
          end try
          
          -- Force Finder to save view settings
          tell application "System Events"
            keystroke "s" using {command down}
          end tell
          
          -- Wait for settings to save
          delay 1
          
          -- Close window
          close theWindow
          
          -- Wait a bit more
          delay 0.5
        end try
      end tell
    `;
    
    console.log('Applying view settings...');
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { stdio: 'inherit' });
    
    // Also try to touch the .DS_Store to force update
    try {
      const dsStorePath = join(volumePath, '.DS_Store');
      execSync(`touch "${dsStorePath}"`, { stdio: 'ignore' });
    } catch (err) {
      // Ignore
    }
    
    console.log('✓ View settings applied');
    
  } catch (err) {
    console.warn('Warning: Could not fix DMG view settings:', err.message);
    console.warn('You may need to manually arrange icons in Finder');
  } finally {
    if (volumePath && needsDetach) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        execSync(`hdiutil detach "${volumePath}" -quiet`, { stdio: 'ignore' });
        console.log('✓ DMG detached');
      } catch (err) {
        console.log('Note: Volume may already be detached');
      }
    }
  }

  console.log('\nDone! Try opening the DMG now.');
  console.log('If icons still don\'t show, you may need to:');
  console.log('1. Open the DMG');
  console.log('2. Press Cmd+J to open View Options');
  console.log('3. Set to Icon view, 72px icons');
  console.log('4. Arrange icons manually');
  console.log('5. Close the window');
}

fixDMGView().catch(err => {
  console.error('Error fixing DMG view:', err);
  process.exit(1);
});

