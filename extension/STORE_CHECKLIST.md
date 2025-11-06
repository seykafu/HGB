# Chrome Web Store Submission Checklist

Use this checklist before submitting to ensure everything is ready.

## Pre-Submission

### Build & Package
- [ ] Extension builds without errors (`npm run build`)
- [ ] ZIP package created successfully
- [ ] ZIP file size is reasonable (< 100MB recommended)
- [ ] All files are included in ZIP (manifest.json, assets, inject/, etc.)
- [ ] No source maps included in production (optional but recommended)

### Manifest
- [ ] Version number is appropriate (0.1.0 for first release)
- [ ] Name is clear and descriptive
- [ ] Description is accurate
- [ ] All permissions are justified
- [ ] Icons are referenced correctly (if added to manifest)

### Assets Required
- [ ] **16x16 icon** - `icon_16.png`
- [ ] **48x48 icon** - `icon_48.png`
- [ ] **128x128 icon** - `icon_128.png`
- [ ] **At least 1 screenshot** (1280x800 minimum)
- [ ] **Promotional images** (optional but recommended)

### Store Listing
- [ ] Extension name (max 45 characters)
- [ ] Short summary (max 132 characters)
- [ ] Detailed description (max 16,000 characters)
- [ ] Category selected
- [ ] Language(s) selected
- [ ] Privacy policy URL (required!)
- [ ] Support URL (optional but recommended)
- [ ] Homepage URL (optional)

### Privacy & Policies
- [ ] Privacy policy created and hosted
- [ ] Privacy policy URL is accessible
- [ ] Privacy policy covers all data collection/usage
- [ ] Extension complies with Chrome Web Store policies
- [ ] No prohibited content

### Testing
- [ ] Extension works on latest Chrome version
- [ ] Extension works on Chrome Beta (optional but recommended)
- [ ] No console errors in production build
- [ ] All features work as expected
- [ ] Permissions are necessary and used correctly
- [ ] Extension doesn't break existing websites

### Legal
- [ ] You own or have rights to all assets
- [ ] No trademark violations
- [ ] Terms of service (if applicable)
- [ ] Contact information provided

## Quick Commands

### Create Package (macOS/Linux)
```bash
npm run package
```

### Create Package (Windows)
```bash
npm run package:windows
```

### Manual Package
```bash
npm run build
cd dist
zip -r ../paralogue-extension.zip .  # macOS/Linux
# OR right-click dist folder → Send to → Compressed folder (Windows)
```

## Common Issues

### ZIP Structure
❌ Wrong: `paralogue-extension.zip/dist/manifest.json`  
✅ Correct: `paralogue-extension.zip/manifest.json`

### Missing Files
- Ensure `manifest.json` is in root of ZIP
- Include all assets referenced in manifest
- Include `inject/` folder if using content scripts

### Privacy Policy
- Must be hosted on a publicly accessible URL
- Cannot be a localhost URL
- GitHub Pages is free and works well

### Permissions
- Justify all permissions in description
- Only request necessary permissions
- `host_permissions` for localhost is acceptable for dev tools

## Submission Steps

1. **Build & Package**
   ```bash
   npm run package
   ```

2. **Go to Developer Dashboard**
   - https://chrome.google.com/webstore/devconsole
   - Sign in with Google account

3. **Create New Item**
   - Click "New Item"
   - Upload ZIP file
   - Fill in store listing

4. **Review & Submit**
   - Review all information
   - Submit for review
   - Wait for approval (1-7 days)

## Post-Submission

- [ ] Monitor email for review status
- [ ] Respond to any reviewer questions promptly
- [ ] Fix any issues if rejected
- [ ] Update version number for updates

## Resources

- [Chrome Web Store Developer Docs](https://developer.chrome.com/docs/webstore/)
- [Chrome Web Store Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Manifest V3 Docs](https://developer.chrome.com/docs/extensions/mv3/intro/)

Good luck! 🚀

