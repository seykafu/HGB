#!/bin/bash
# Script to fix DMG Finder view settings after creation
# This ensures the app and Applications link are visible

DMG_PATH="$1"

if [ -z "$DMG_PATH" ]; then
    echo "Usage: ./fix-dmg-view.sh <path-to-dmg>"
    exit 1
fi

echo "Fixing DMG view settings for: $DMG_PATH"

# Mount the DMG
VOLUME_NAME=$(hdiutil attach "$DMG_PATH" -readonly -noverify -noautoopen 2>&1 | grep -i "Volumes" | awk -F'\t' '{print $3}' | head -1)

if [ -z "$VOLUME_NAME" ]; then
    echo "Failed to mount DMG"
    exit 1
fi

VOLUME_PATH="/Volumes/$VOLUME_NAME"
echo "Mounted at: $VOLUME_PATH"

# Set Finder view options using AppleScript
osascript <<EOF
tell application "Finder"
    set theWindow to make new Finder window
    set target of theWindow to folder "$VOLUME_NAME" of disk "Volumes"
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
    
    close theWindow
end tell
EOF

# Detach the DMG
hdiutil detach "$VOLUME_PATH" -quiet

echo "✓ DMG view settings updated"

