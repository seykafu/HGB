#!/bin/bash
# Script to fix DMG Finder view settings
# This ensures the app and Applications link are visible in the DMG window

DMG_PATH="$1"

if [ -z "$DMG_PATH" ]; then
    echo "Usage: ./fix-dmg.sh <path-to-dmg>"
    exit 1
fi

if [ ! -f "$DMG_PATH" ]; then
    echo "Error: DMG file not found: $DMG_PATH"
    exit 1
fi

echo "Fixing DMG view settings for: $DMG_PATH"

# Create a temporary mount point
TEMP_DIR=$(mktemp -d)
MOUNT_POINT="$TEMP_DIR/mount"

# Mount the DMG
VOLUME_NAME=$(hdiutil attach "$DMG_PATH" -readonly -noverify -noautoopen -mountpoint "$MOUNT_POINT" 2>&1 | grep -i "Volumes" | awk -F'\t' '{print $3}' | head -1)

if [ -z "$VOLUME_NAME" ]; then
    # Try alternative mount method
    hdiutil attach "$DMG_PATH" -readonly -noverify -noautoopen > /dev/null 2>&1
    VOLUME_NAME=$(ls /Volumes/ | grep -i "Himalayan" | head -1)
    MOUNT_POINT="/Volumes/$VOLUME_NAME"
fi

if [ ! -d "$MOUNT_POINT" ]; then
    echo "Error: Failed to mount DMG"
    exit 1
fi

echo "Mounted at: $MOUNT_POINT"

# Use AppleScript to configure Finder view
osascript <<EOF
tell application "Finder"
    try
        set theVolume to disk "$VOLUME_NAME"
        set theWindow to open theVolume
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
        
        -- Save view options
        close theWindow
    end try
end tell
EOF

# Detach the DMG
hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || hdiutil detach "/Volumes/$VOLUME_NAME" -quiet 2>/dev/null

echo "✓ DMG view settings updated"
echo "Note: You may need to rebuild the DMG for changes to take effect"

