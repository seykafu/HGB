# Publishing to Chrome Web Store

This guide walks you through publishing the Paralogue NPC Copilot extension to the Chrome Web Store.

## Prerequisites

1. **Chrome Web Store Developer Account**
   - One-time registration fee: **$5 USD** (one-time payment)
   - Sign up at: https://chrome.google.com/webstore/devconsole
   - Use your Google account

2. **Prepare Your Extension**
   - Build the extension for production
   - Create required assets (icons, screenshots, descriptions)

## Step 1: Prepare Production Build

### Build the Extension

```bash
cd extension
npm run build
```

This creates a `dist/` folder with your production-ready extension.

### Create ZIP Package

1. Navigate to the `dist/` folder
2. Create a ZIP file containing all files in `dist/`:
   - **macOS/Linux**: `cd dist && zip -r ../paralogue-extension.zip .`
   - **Windows**: Right-click `dist` folder → Send to → Compressed (zipped) folder
   - **Important**: Zip the CONTENTS of `dist/`, not the `dist/` folder itself

### Verify ZIP Structure

Your ZIP should look like this when extracted:
```
paralogue-extension.zip
├── manifest.json
├── inject/
│   ├── index.js
│   └── index.css
├── assets/
│   └── ...
└── ...
```

## Step 2: Prepare Store Assets

### Required Assets

1. **Extension Icons** (create these sizes):
   - `icon_16.png` - 16x16 pixels
   - `icon_48.png` - 48x48 pixels
   - `icon_128.png` - 128x128 pixels

2. **Screenshots** (at least 1, recommended 5):
   - Minimum: 1280x800 pixels
   - Recommended: 1280x800 or 1920x1200
   - Format: PNG or JPEG
   - Show the extension in action (popup, sidebar, chat interface)

3. **Promotional Images** (optional but recommended):
   - Small promo tile: 440x280 pixels
   - Large promo tile: 920x680 pixels
   - Marque: 1400x560 pixels

### Create Icons

You can use your existing mascot logo (`extension/src/assets/mascot.png`) and resize it:

```bash
# Using ImageMagick (install if needed)
convert src/assets/mascot.png -resize 16x16 store-assets/icon_16.png
convert src/assets/mascot.png -resize 48x48 store-assets/icon_48.png
convert src/assets/mascot.png -resize 128x128 store-assets/icon_128.png
```

Or use online tools like:
- https://www.iloveimg.com/resize-image
- https://www.favicon-generator.org/

## Step 3: Write Store Listing

### Required Information

1. **Name**: "Paralogue NPC Copilot" (or your preferred name, max 45 characters)

2. **Summary**: Short description (max 132 characters)
   ```
   AI-powered copilot for indie game developers to design and control NPC agents in Unity, Unreal, and Frostbite.
   ```

3. **Description**: Detailed description (max 16,000 characters)
   ```
   Paralogue NPC Copilot is a powerful Chrome extension designed for indie game developers building open-world and sandbox games with AI-powered NPCs.

   Features:
   - 🤖 Multi-Agent AI System: Intelligent orchestrator routes your questions to specialized agents (RAG, coding, debugging)
   - 📚 Documentation Search: RAG-powered search over Unity, Unreal, and Frostbite documentation
   - 💻 Code Generation: Get ready-to-use code snippets for NPC integration
   - 🐛 Debugging Assistant: Automatically diagnose console errors and provide fixes
   - 🎮 Game Actions: Control NPCs in real-time via postMessage or WebSocket
   - 🎨 Beautiful UI: Medieval-themed, parchment-style interface with smooth animations

   Use Cases:
   - Design NPC agents with custom system prompts, traits, and goals
   - Get instant documentation answers while coding
   - Generate integration code for Unity/Unreal/Frostbite
   - Debug game issues with AI-powered diagnostics
   - Control NPCs in your running game via chat commands

   Perfect for indie developers working on:
   - Open-world games
   - Sandbox experiences
   - NPC-driven narratives
   - Multi-agent game systems

   Privacy: All processing happens locally or through your configured API endpoints. No data is shared with third parties.
   ```

4. **Category**: Choose one:
   - Developer Tools
   - Productivity
   - Fun

5. **Language**: English (and any others you support)

6. **Privacy Policy URL** (Required):
   - Create a privacy policy page
   - Host it on your website or GitHub Pages
   - Example: `https://yourdomain.com/privacy` or `https://yourusername.github.io/paralogue/privacy`

## Step 4: Create Privacy Policy

Create a `PRIVACY_POLICY.md` file:

```markdown
# Privacy Policy for Paralogue NPC Copilot

Last updated: [Date]

## Data Collection
Paralogue NPC Copilot does not collect, store, or transmit any personal data.

## Local Storage
The extension uses Chrome's local storage API to save:
- Extension settings (API keys, preferences)
- Chat conversation history
- NPC profiles
All data is stored locally on your device and never transmitted to external servers.

## API Usage
- OpenAI API: If you use Direct OpenAI mode, API calls are made directly from your browser to OpenAI. We do not intercept or store these calls.
- Proxy Mode: If you use proxy mode, API calls go to your configured proxy URL (typically localhost). No data is sent to our servers.

## Third-Party Services
- OpenAI API: When using Direct OpenAI mode, your API key is stored locally and used to make API calls. We do not have access to your API key or the content of your requests.

## Contact
For privacy concerns, contact: [your-email@example.com]
```

Host this on GitHub Pages or your website.

## Step 5: Submit to Chrome Web Store

1. **Go to Developer Dashboard**
   - Visit: https://chrome.google.com/webstore/devconsole
   - Sign in with your Google account

2. **Create New Item**
   - Click "New Item"
   - Upload your ZIP file (from Step 1)
   - Click "Upload"

3. **Fill in Store Listing**
   - Complete all required fields:
     - Name
     - Summary
     - Description
     - Category
     - Language
     - Privacy Policy URL
   - Upload icons and screenshots
   - Add promotional images (optional)

4. **Set Visibility**
   - **Unlisted**: Only accessible via direct link (good for testing)
   - **Public**: Listed in Chrome Web Store (requires approval)

5. **Submit for Review**
   - Click "Submit for Review"
   - Review can take 1-7 days
   - You'll receive email notifications about status

## Step 6: Post-Submission

### Review Process
- Google reviews for policy compliance
- Usually takes 1-7 business days
- You'll receive email updates

### Common Rejection Reasons
- Missing privacy policy
- Insufficient description
- Poor quality screenshots
- Violation of Chrome Web Store policies
- Permissions not justified

### After Approval
- Extension goes live
- Users can install from Chrome Web Store
- You can update versions anytime

## Step 7: Updating Your Extension

1. **Update Version**
   - Edit `src/manifest.ts`:
     ```typescript
     version: '0.1.1' // Increment version
     ```

2. **Rebuild and Rezip**
   ```bash
   npm run build
   cd dist && zip -r ../paralogue-extension-v0.1.1.zip .
   ```

3. **Upload New Version**
   - Go to Developer Dashboard
   - Select your extension
   - Click "Package" → "Upload new package"
   - Upload new ZIP
   - Submit for review (updates are usually faster)

## Tips for Success

1. **Good Screenshots**: Show the extension in action, highlight key features
2. **Clear Description**: Explain what it does and why users need it
3. **Privacy Policy**: Must be accessible and comprehensive
4. **Test Thoroughly**: Test on multiple Chrome versions before submitting
5. **Support**: Provide contact/support information

## Resources

- [Chrome Web Store Developer Documentation](https://developer.chrome.com/docs/webstore/)
- [Chrome Web Store Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)

## Checklist Before Submission

- [ ] Extension builds without errors
- [ ] ZIP file contains all necessary files
- [ ] All icons created (16x16, 48x48, 128x128)
- [ ] At least 1 screenshot (1280x800 minimum)
- [ ] Privacy policy created and hosted
- [ ] Store listing description complete
- [ ] Extension tested on latest Chrome
- [ ] Version number set appropriately
- [ ] No console errors in production build
- [ ] Permissions are justified in description

Good luck with your submission! 🚀

