# Extension UI Update - Reload Instructions

The Popup UI has been updated with the new parchment fantasy design. To see the changes:

## Quick Steps

1. **Build the extension:**
   ```bash
   cd extension
   npm run build
   ```

2. **Reload the extension in Chrome:**
   - Go to `chrome://extensions/`
   - Find "Paralogue NPC Copilot"
   - Click the **reload icon** (circular arrow) 🔄
   - OR toggle it off and back on

3. **Open the popup:**
   - Click the extension icon in Chrome toolbar
   - You should see the new parchment-styled UI with:
     - Ghost mascot with crossed swords
     - Gold sparkles
     - "GAMING COPILOT" title in Cinzel font
     - Parchment card with corner accents
     - Gold beveled "Send" button
     - Outlined "Options" button with corner accents

## If Build Fails

The build might have issues with crxjs. Try:

```bash
cd extension
rm -rf node_modules dist
npm install
npm run build
```

## New UI Features

- ✅ Parchment card styling (#FBF7EF background)
- ✅ Ghost mascot (white with brown stroke)
- ✅ Crossed swords behind mascot
- ✅ Gold sparkles on sides
- ✅ Cinzel font for "GAMING COPILOT" title
- ✅ Inner content box with parchment styling
- ✅ Gold beveled Send button
- ✅ Outlined Options button with corner accents
- ✅ Dark brown text (#2E2A25)
- ✅ Proper spacing and layout

## Files Changed

- `extension/src/ui/Popup.tsx` - Main popup component
- `extension/src/ui/Popup.css` - Styles with Tailwind
- `extension/src/ui/components/Card.tsx` - Parchment card with corner accents
- `extension/src/ui/components/Button.tsx` - Gold beveled and outlined variants
- `extension/src/ui/components/Input.tsx` - Parchment-styled inputs
- `extension/src/ui/mascot/Mascot.tsx` - Ghost mascot
- `extension/src/ui/icons/Swords.tsx` - Crossed swords icon
- `extension/src/ui/icons/Sparkle.tsx` - Sparkle icon

