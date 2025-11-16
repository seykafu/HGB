# Building Installable Packages

This guide explains how to build installable packages for macOS (.dmg) and Windows (.exe).

## Prerequisites

1. **Node.js and npm** installed
2. **For macOS builds**: Must be run on macOS
3. **For Windows builds**: Can be run on any platform (cross-compilation supported)

## Icon Files

✅ **Icons have been created!** The red panda logo has been converted to:
- **macOS**: `build/icon.icns` (multi-resolution icon set)
- **Windows**: `build/icon.ico` (256x256 icon)

The icons are automatically generated from `src/assets/redpanda.png` and are ready to use.

### Recreating Icons (if needed)

If you need to recreate the icons from the red panda PNG (`src/assets/redpanda.png`):

**Option 1: Online Tools**
- Use online converters like:
  - https://cloudconvert.com/png-to-icns (for macOS)
  - https://cloudconvert.com/png-to-ico (for Windows)
  - https://convertio.co/png-icns/ (for macOS)
  - https://convertio.co/png-ico/ (for Windows)

**Option 2: macOS (for .icns)**
```bash
# Create an iconset directory
mkdir -p build/icon.iconset

# Convert PNG to different sizes (required for .icns)
sips -z 16 16     src/assets/redpanda.png --out build/icon.iconset/icon_16x16.png
sips -z 32 32     src/assets/redpanda.png --out build/icon.iconset/icon_16x16@2x.png
sips -z 32 32     src/assets/redpanda.png --out build/icon.iconset/icon_32x32.png
sips -z 64 64     src/assets/redpanda.png --out build/icon.iconset/icon_32x32@2x.png
sips -z 128 128   src/assets/redpanda.png --out build/icon.iconset/icon_128x128.png
sips -z 256 256   src/assets/redpanda.png --out build/icon.iconset/icon_128x128@2x.png
sips -z 256 256   src/assets/redpanda.png --out build/icon.iconset/icon_256x256.png
sips -z 512 512   src/assets/redpanda.png --out build/icon.iconset/icon_256x256@2x.png
sips -z 512 512   src/assets/redpanda.png --out build/icon.iconset/icon_512x512.png
sips -z 1024 1024 src/assets/redpanda.png --out build/icon.iconset/icon_512x512@2x.png

# Convert iconset to .icns
iconutil -c icns build/icon.iconset -o build/icon.icns
```

**Option 3: Use electron-icon-maker (npm package)**
```bash
npm install -g electron-icon-maker
electron-icon-maker --input=src/assets/redpanda.png --output=build/
```

**Note**: If icon files are missing, electron-builder will use default icons. The build will still work.

## Building Packages

### Build macOS .dmg (on macOS)

```bash
cd desktop
npm run build:mac
```

This will create:
- `release/Himalayan Game Builder-0.1.0-arm64.dmg` (for Apple Silicon)
- `release/Himalayan Game Builder-0.1.0-x64.dmg` (for Intel Macs)

### Build Windows .exe (on any platform)

```bash
cd desktop
npm run build:win
```

This will create:
- `release/Himalayan Game Builder Setup 0.1.0.exe` (NSIS installer for x64)
- `release/Himalayan Game Builder Setup 0.1.0-ia32.exe` (NSIS installer for 32-bit)

### Build Both Platforms

```bash
cd desktop
npm run build:all
```

This will create installers for both macOS and Windows.

## Output Location

All built installers will be in the `desktop/release/` directory.

## Troubleshooting

### Missing Icons
If you see warnings about missing icons, the build will still work but use default Electron icons. To fix:
1. Create the `build/` directory: `mkdir -p build`
2. Add `icon.icns` (macOS) and/or `icon.ico` (Windows) to the `build/` directory

### Build Fails
1. Make sure all dependencies are installed: `npm install`
2. Ensure the app builds successfully: `npm run build`
3. Check that electron-builder is installed: `npm list electron-builder`

### Cross-Platform Building
- **macOS builds**: Must be run on macOS
- **Windows builds**: Can be built on macOS, Linux, or Windows
- For best results, build each platform on its native OS

## Distribution

After building:
1. Test the installer on the target platform
2. The .dmg (macOS) and .exe (Windows) files can be distributed to users
3. Users can double-click to install the application

