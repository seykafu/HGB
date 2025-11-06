#!/bin/bash
# Script to package the extension for Chrome Web Store submission

echo "🏗️  Building extension for production..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "📦 Creating ZIP package..."
cd dist

# Remove any existing ZIP files
rm -f ../paralogue-extension.zip

# Create ZIP with all contents
zip -r ../paralogue-extension.zip . -x "*.map" "*.DS_Store"

cd ..

echo "✅ Package created: paralogue-extension.zip"
echo "📏 Package size: $(du -h paralogue-extension.zip | cut -f1)"
echo ""
echo "📋 Next steps:"
echo "1. Go to https://chrome.google.com/webstore/devconsole"
echo "2. Create new item or update existing"
echo "3. Upload paralogue-extension.zip"
echo "4. Complete store listing"
echo "5. Submit for review"

