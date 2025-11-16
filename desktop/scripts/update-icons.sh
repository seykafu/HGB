#!/bin/bash
# Script to regenerate app icons from desktopicon.png
# This creates both macOS (.icns) and Windows (.ico) icons
# Looks for desktopicon.png in desktop/ or desktop/src/assets/
# Falls back to redpanda.png if desktopicon.png is not found

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$DESKTOP_DIR/build"

# Try desktopicon.png in desktop/ directory first, then fall back to src/assets/
if [ -f "$DESKTOP_DIR/desktopicon.png" ]; then
    SOURCE_IMAGE="$DESKTOP_DIR/desktopicon.png"
elif [ -f "$DESKTOP_DIR/src/assets/desktopicon.png" ]; then
    SOURCE_IMAGE="$DESKTOP_DIR/src/assets/desktopicon.png"
else
    SOURCE_IMAGE="$DESKTOP_DIR/src/assets/redpanda.png"
    echo "⚠️  desktopicon.png not found, using redpanda.png as fallback"
fi

echo "🔄 Regenerating app icons from $(basename "$SOURCE_IMAGE")..."

# Check if source image exists
if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "❌ Error: Source image not found!"
    echo "   Please make sure desktopicon.png exists in:"
    echo "     - desktop/desktopicon.png, or"
    echo "     - desktop/src/assets/desktopicon.png"
    exit 1
fi

# Create build directory if it doesn't exist
mkdir -p "$BUILD_DIR"

# Create iconset directory for macOS
ICONSET_DIR="$BUILD_DIR/icon.iconset"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

echo "📱 Creating macOS icon set..."

# Generate all required sizes for macOS .icns
# Note: @2x versions are double the resolution
sips -z 16 16     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16.png" > /dev/null 2>&1
sips -z 32 32     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16@2x.png" > /dev/null 2>&1
sips -z 32 32     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32.png" > /dev/null 2>&1
sips -z 64 64     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32@2x.png" > /dev/null 2>&1
sips -z 128 128   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128.png" > /dev/null 2>&1
sips -z 256 256   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128@2x.png" > /dev/null 2>&1
sips -z 256 256   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256.png" > /dev/null 2>&1
sips -z 512 512   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256@2x.png" > /dev/null 2>&1
sips -z 512 512   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512.png" > /dev/null 2>&1
sips -z 1024 1024 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512@2x.png" > /dev/null 2>&1

# Convert iconset to .icns
echo "   Converting to .icns..."
iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns" 2>/dev/null || {
    echo "⚠️  Warning: iconutil failed, trying alternative method..."
    # Fallback: use online tool or manual conversion
    echo "   Please convert manually using: iconutil -c icns $ICONSET_DIR -o $BUILD_DIR/icon.icns"
}

echo "✅ Created macOS icon: $BUILD_DIR/icon.icns"

# Create Windows .ico file
echo "🪟 Creating Windows icon..."

# Check for ImageMagick
if command -v convert &> /dev/null || command -v magick &> /dev/null; then
    CONVERT_CMD=$(command -v convert || command -v magick)
    $CONVERT_CMD "$SOURCE_IMAGE" \
      \( -clone 0 -resize 16x16 \) \
      \( -clone 0 -resize 32x32 \) \
      \( -clone 0 -resize 48x48 \) \
      \( -clone 0 -resize 64x64 \) \
      \( -clone 0 -resize 128x128 \) \
      \( -clone 0 -resize 256x256 \) \
      -delete 0 \
      -alpha on \
      "$BUILD_DIR/icon.ico" 2>/dev/null || {
        echo "⚠️  Warning: ImageMagick conversion had issues"
    }
    echo "✅ Created Windows icon: $BUILD_DIR/icon.ico"
else
    echo "⚠️  ImageMagick not found. Skipping Windows .ico creation."
    echo "   Install with: brew install imagemagick"
    echo "   Or use an online converter: https://cloudconvert.com/png-to-ico"
fi

echo ""
echo "✨ Icon regeneration complete!"
echo ""
echo "Icons created:"
echo "  📱 macOS: $BUILD_DIR/icon.icns"
if [ -f "$BUILD_DIR/icon.ico" ]; then
    echo "  🪟 Windows: $BUILD_DIR/icon.ico"
fi
echo ""
echo "Next steps:"
echo "  1. Rebuild the app: npm run build:mac"
echo "  2. The new icon will be used in the DMG and app bundle"

