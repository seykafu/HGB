#!/usr/bin/env node
/**
 * Fix DMG view settings by converting to writable format, applying settings, then converting back
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, renameSync, existsSync } from 'fs';
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
  console.log('No DMG files found');
  process.exit(0);
}

if (!dmgFile) {
  console.log('No DMG file to fix');
  process.exit(0);
}

async function fixDMG() {
  const tempDMG = dmgFile.replace('.dmg', '-temp.dmg');
  let volumePath = null;
  
  try {
    console.log('Step 1: Converting DMG to writable format...');
    
    // Convert read-only DMG to writable
    execSync(`hdiutil convert "${dmgFile}" -format UDRW -o "${tempDMG}"`, {
      stdio: 'inherit'
    });
    
    console.log('Step 2: Mounting writable DMG...');
    execSync(`hdiutil attach "${tempDMG}" -noverify -noautoopen`, {
      encoding: 'utf8',
      stdio: 'ignore'
    });
    
    // Wait for mount to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find the mounted volume (look for the temp one, not the original)
    const volumes = execSync('ls /Volumes/', { encoding: 'utf8' }).split('\n').filter(v => v.trim());
    const mountedVolume = volumes.find(v => v.includes('Himalayan'));
    
    if (!mountedVolume) {
      throw new Error('Could not find mounted volume');
    }
    
    volumePath = `/Volumes/${mountedVolume}`;
    console.log(`Mounted at: ${volumePath}`);
    const volumeName = volumePath.split('/').pop();
    
    console.log('Step 3: Applying Finder view settings...');
    
    // Use AppleScript to configure and save view settings
    const script = `
      tell application "Finder"
        activate
        try
          set theVolume to disk "${volumeName}"
          set theWindow to open theVolume
          
          delay 0.5
          
          set current view of theWindow to icon view
          set toolbar visible of theWindow to false
          set statusbar visible of theWindow to false
          set bounds of theWindow to {400, 100, 940, 480}
          
          set theOptions to icon view options of theWindow
          set arrangement of theOptions to not arranged
          set icon size of theOptions to 72
          set text size of theOptions to 12
          set label position of theOptions to bottom
          set shows item info of theOptions to false
          set shows icon preview of theOptions to true
          
          try
            set appItem to item "Himalayan Game Builder.app" of theVolume
            set position of appItem to {130, 220}
          end try
          
          try
            set appsLink to item "Applications" of theVolume
            set position of appsLink to {410, 220}
          end try
          
          -- Save settings
          delay 1
          close theWindow
          delay 0.5
        end try
      end tell
    `;
    
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { stdio: 'inherit' });
    
    console.log('Step 4: Closing Finder windows and unmounting...');
    
    // Close any Finder windows for this volume
    try {
      execSync(`osascript -e 'tell application "Finder" to close every window whose target is disk "${volumeName}"'`, { stdio: 'ignore' });
    } catch (err) {
      // Ignore if no windows to close
    }
    
    // Wait a bit for Finder to finish
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try gentle detach first
    let detached = false;
    try {
      execSync(`hdiutil detach "${volumePath}" -quiet`, { stdio: 'ignore' });
      detached = true;
    } catch (err) {
      // If that fails, force detach
      console.log('Gentle detach failed, forcing...');
      try {
        execSync(`hdiutil detach "${volumePath}" -force -quiet`, { stdio: 'ignore' });
        detached = true;
      } catch (err2) {
        // If still failing, try eject
        console.log('Force detach failed, trying eject...');
        try {
          execSync(`diskutil eject "${volumePath}"`, { stdio: 'ignore' });
          detached = true;
        } catch (err3) {
          console.warn('Warning: Could not detach volume. You may need to manually eject it.');
          console.warn(`Volume path: ${volumePath}`);
        }
      }
    }
    
    if (!detached) {
      throw new Error('Failed to detach volume. Please manually eject it and try again.');
    }
    
    console.log('Step 5: Converting back to read-only UDZO format...');
    
    // Backup original
    const backupDMG = dmgFile.replace('.dmg', '-backup.dmg');
    if (existsSync(dmgFile)) {
      renameSync(dmgFile, backupDMG);
      console.log(`Backed up original to: ${backupDMG.split('/').pop()}`);
    }
    
    // Convert back to read-only UDZO
    execSync(`hdiutil convert "${tempDMG}" -format UDZO -o "${dmgFile}"`, {
      stdio: 'inherit'
    });
    
    // Clean up temp file
    try {
      execSync(`rm "${tempDMG}"`, { stdio: 'ignore' });
    } catch (err) {
      // Ignore
    }
    
    console.log('\n✓ DMG fixed successfully!');
    console.log(`Fixed DMG: ${dmgFile.split('/').pop()}`);
    console.log(`Backup saved: ${backupDMG.split('/').pop()}`);
    
  } catch (err) {
    console.error('Error:', err.message);
    
    // Cleanup on error
    if (volumePath) {
      try {
        execSync(`hdiutil detach "${volumePath}" -force -quiet`, { stdio: 'ignore' });
      } catch (e) {
        // Ignore
      }
    }
    
    if (existsSync(tempDMG)) {
      try {
        execSync(`rm "${tempDMG}"`, { stdio: 'ignore' });
      } catch (e) {
        // Ignore
      }
    }
    
    process.exit(1);
  }
}

fixDMG().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

