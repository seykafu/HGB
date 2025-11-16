#!/usr/bin/env node
/**
 * Post-build script to fix DMG Finder view settings
 * This ensures the app and Applications link are visible in the DMG window
 */

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
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
  console.log('Fixing DMG view settings...');

  // Check if volume is already mounted
  let volumePath = null;
  let needsDetach = false;

  try {
    // First, check if the volume is already mounted
    const volumes = execSync('ls /Volumes/', { encoding: 'utf8' }).split('\n').filter(v => v.trim());
    const existingVolume = volumes.find(v => v.includes('Himalayan'));
    
    if (existingVolume) {
      volumePath = `/Volumes/${existingVolume}`;
      console.log(`Volume already mounted at: ${volumePath}`);
    } else {
      // Mount the DMG if not already mounted
      console.log('Mounting DMG...');
      const mountOutput = execSync(`hdiutil attach "${dmgFile}" -readonly -noverify -noautoopen -nobrowse`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      // Extract volume path from output
      const lines = mountOutput.split('\n');
      for (const line of lines) {
        if (line.includes('/Volumes/')) {
          const match = line.match(/\/Volumes\/[^\s]+/);
          if (match) {
            volumePath = match[0];
            needsDetach = true;
            break;
          }
        }
      }
      
      // Fallback: try to find it after mounting
      if (!volumePath) {
        // Wait a moment for mount to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        const newVolumes = execSync('ls /Volumes/', { encoding: 'utf8' }).split('\n').filter(v => v.trim());
        const newVolume = newVolumes.find(v => v.includes('Himalayan'));
        if (newVolume) {
          volumePath = `/Volumes/${newVolume}`;
          needsDetach = true;
        }
      }
      
      if (!volumePath) {
        throw new Error('Could not find mounted volume');
      }
      
      console.log(`Mounted at: ${volumePath}`);
    }
    
    // Use AppleScript to configure Finder view and save settings
    const volumeName = volumePath.split('/').pop();
    const script = `
      tell application "Finder"
        try
          set theVolume to disk "${volumeName}"
          set theWindow to open theVolume
          
          -- Set window properties
          set current view of theWindow to icon view
          set toolbar visible of theWindow to false
          set statusbar visible of theWindow to false
          set bounds of theWindow to {400, 100, 940, 480}
          
          -- Set icon view options
          set theOptions to icon view options of theWindow
          set arrangement of theOptions to not arranged
          set icon size of theOptions to 72
          set text size of theOptions to 12
          set label position of theOptions to bottom
          set shows item info of theOptions to false
          set shows icon preview of theOptions to true
          
          -- Position the app icon
          try
            set appItem to item "Himalayan Game Builder.app" of theVolume
            set position of appItem to {130, 220}
          end try
          
          -- Position the Applications link
          try
            set appsLink to item "Applications" of theVolume
            set position of appsLink to {410, 220}
          end try
          
          -- Force save view settings
          update theVolume
          
          -- Keep window open briefly to ensure settings are saved
          delay 0.5
          close theWindow
          
          -- Save view settings
          delay 0.2
        end try
      end tell
    `;
    
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { stdio: 'inherit' });
    
    // Also try using SetFile to set custom icon positions (if available)
    try {
      execSync(`SetFile -a V "${join(volumePath, 'Himalayan Game Builder.app')}"`, { stdio: 'ignore' });
    } catch (err) {
      // SetFile might not be available, that's okay
    }
    
    console.log('✓ View settings applied');
    
  } catch (err) {
    console.warn('Warning: Could not fix DMG view settings:', err.message);
    console.warn('The DMG will work, but you may need to manually arrange the icons');
  } finally {
    // Only detach if we mounted it ourselves
    if (volumePath && needsDetach) {
      try {
        // Wait a moment before detaching
        await new Promise(resolve => setTimeout(resolve, 1000));
        execSync(`hdiutil detach "${volumePath}" -quiet`, { stdio: 'ignore' });
        console.log('✓ DMG detached');
      } catch (err) {
        // Ignore detach errors - volume might already be detached
        console.log('Note: Volume may already be detached');
      }
    }
  }

  console.log('Done!');
}

fixDMGView().catch(err => {
  console.error('Error fixing DMG view:', err);
  process.exit(1);
});

