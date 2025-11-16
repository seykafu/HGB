#!/bin/bash
# Script to create Windows .ico file from PNG
# Requires ImageMagick (install with: brew install imagemagick)

if ! command -v convert &> /dev/null && ! command -v magick &> /dev/null; then
    echo "ImageMagick not found. Installing..."
    if command -v brew &> /dev/null; then
        brew install imagemagick
    else
        echo "Please install ImageMagick manually: https://imagemagick.org/script/download.php"
        exit 1
    fi
fi

CONVERT_CMD=$(command -v convert || command -v magick)

echo "Creating Windows icon from redpanda.png..."

# Create .ico with multiple sizes (required for Windows)
$CONVERT_CMD src/assets/redpanda.png \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  \( -clone 0 -resize 128x128 \) \
  \( -clone 0 -resize 256x256 \) \
  -delete 0 \
  -alpha on \
  build/icon.ico

echo "✓ Created build/icon.ico"

