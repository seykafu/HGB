# Quick Setup Guide

## 1. Install Dependencies

```bash
cd extension
npm install
```

## 2. Create Icon Files

You need to create three icon files in `src/assets/`:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

For quick testing, you can create simple placeholder PNG files or use an online icon generator.

## 3. Build the Extension

```bash
npm run build
```

This creates a `dist` folder with the compiled extension.

## 4. Load in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `extension/dist` folder

## 5. Test the Extension

1. Navigate to any `http://localhost:*` page (e.g., `http://localhost:5173`)
2. The Paralogue panel should automatically appear
3. Click the extension icon to open the popup
4. Go to Options to configure your backend

## Configuration

### Backend Modes

**Proxy Mode (Recommended):**
- Set Backend Mode to "Proxy Mode"
- Enter your Next.js API URL: `http://localhost:3000/api/chat`
- This uses your existing Paralogue Next.js backend

**Direct OpenAI:**
- Set Backend Mode to "Direct OpenAI"
- Enter your OpenAI API key
- Select a model (gpt-4o-mini, gpt-4o, etc.)
- ⚠️ Warning: API key stored in browser storage

### Using NPCs

1. **Create NPC**: Go to "NPC" tab → Fill in details → Click "Save NPC"
2. **Chat**: Select NPC → Go to "Chat" tab → Type messages
3. **Actions**: Use Action Bar buttons or NPCs will emit actions from chat
4. **Log**: View all emitted actions in the "Log" tab

### WebSocket Integration

1. Go to "World" tab
2. Enter WebSocket URL (e.g., `ws://localhost:5173/npc`)
3. Click "Connect WS"
4. Actions will be sent via WebSocket when connected

### Listening for Actions in Your Game

```javascript
// Method 1: Custom event
window.addEventListener('paralogue:npc', (event) => {
  const { npcId, action } = event.detail
  console.log('NPC Action:', action)
})

// Method 2: postMessage
window.addEventListener('message', (event) => {
  if (event.data?.source === 'PARALOGUE') {
    const { npcId, action } = event.data
    console.log('NPC Action:', action)
  }
})
```

## Development

```bash
npm run dev
```

This watches for changes and rebuilds automatically.

## Troubleshooting

- **Panel not showing**: Check that you're on `localhost` or `127.0.0.1`
- **Build errors**: Make sure all dependencies are installed (`npm install`)
- **Icons missing**: Create placeholder icons in `src/assets/`
- **API errors**: Check your backend URL or API key in Options

