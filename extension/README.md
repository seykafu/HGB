# Paralogue NPC Copilot - Chrome Extension

A cute, modern Chrome Extension that overlays an NPC-building copilot on localhost pages for indie game developers.

## Features

- 🤖 **NPC Design**: Create and manage NPC profiles with traits, goals, and system prompts
- 💬 **Chat Interface**: Stream LLM responses with real-time typing animations
- 🎮 **Action System**: Emit NPC actions (say, walk, emote) via postMessage or WebSocket
- 🎨 **Modern UI**: Beautiful Tailwind-based draggable sidebar with Shadow DOM isolation
- ⚙️ **Flexible Backend**: Support for proxy mode (Next.js API) or direct OpenAI

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

1. Install dependencies:
```bash
cd extension
npm install
```

2. Create icon files:
   - Create `src/assets/icon16.png`, `icon48.png`, and `icon128.png`
   - Or use placeholder icons for development

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder from the extension directory

### Development Mode

```bash
npm run dev
```

This will watch for changes and rebuild automatically.

## Configuration

### Options Page

1. Click the extension icon → "Options"
2. Configure backend mode:
   - **Proxy Mode**: Use your Next.js API at `http://localhost:3000/api/chat`
   - **Direct OpenAI**: Use OpenAI API directly (requires API key)

### Using the Extension

1. Navigate to any `localhost` or `127.0.0.1` page
2. The Paralogue panel will automatically appear
3. Create NPCs in the "NPC" tab
4. Chat with NPCs in the "Chat" tab
5. Configure WebSocket/postMessage in the "World" tab
6. View action logs in the "Log" tab

## NPC Actions

NPCs can emit actions that your game can listen for:

```javascript
// Listen for NPC actions
window.addEventListener('paralogue:npc', (event) => {
  const { npcId, action } = event.detail
  
  if (action.type === 'say') {
    console.log('NPC says:', action.text)
  } else if (action.type === 'walk') {
    console.log('NPC walks to:', action.to)
  } else if (action.type === 'emote') {
    console.log('NPC emotes:', action.name)
  }
})
```

Or use postMessage:

```javascript
window.addEventListener('message', (event) => {
  if (event.data?.source === 'PARALOGUE') {
    const { npcId, action } = event.data
    // Handle action
  }
})
```

## Action Markers in Chat

NPCs can emit actions through special markers in their responses:

```
<<<ACTION type="say" text="Hello, traveler!" >>>
<<<ACTION type="walk" x=12 y=8>>>
<<<ACTION type="emote" name="wave">>>
```

These are automatically parsed and emitted as actions.

## Project Structure

```
extension/
├── src/
│   ├── manifest.ts          # MV3 manifest
│   ├── background.ts        # Service worker
│   ├── content.ts           # Content script
│   ├── inject/              # React app injected into pages
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── index.css
│   ├── ui/                   # Popup & Options pages
│   ├── lib/                  # Utilities
│   └── types/                # TypeScript types
├── vite.config.ts
└── package.json
```

## Building for Production

```bash
npm run build
```

The built extension will be in the `dist` folder, ready to load in Chrome or publish to the Chrome Web Store.

## Troubleshooting

- **Panel not appearing**: Make sure you're on a `localhost` or `127.0.0.1` URL
- **WebSocket not connecting**: Check the WebSocket URL in the "World" tab
- **API errors**: Verify your backend URL or OpenAI API key in Options

## License

MIT

