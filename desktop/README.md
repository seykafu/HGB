# GameNPC Desktop Application

A macOS desktop application version of the GameNPC Chrome extension, built with Electron, React, TypeScript, and Tailwind CSS.

## Features

- **Multi-Agent AI System**: Orchestrator routes prompts to specialized agents (RAG, Coding, Debugging)
- **Multi-Chat Support**: Up to 3 concurrent chat sessions with tab navigation
- **10-Message Limit**: Each chat session is limited to 10 user messages to keep conversations focused
- **Documentation Search**: RAG-powered search over game development documentation
- **Code Generation**: Generate code snippets, diffs, and integration checklists
- **Settings Management**: Configure backend mode (Proxy or Direct OpenAI), API keys, and models

## Prerequisites

- Node.js 18+ and npm
- macOS 10.13+ (for building macOS app)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your OpenAI API key:
   - Open the app
   - Click the gear icon to open Settings
   - Choose "Direct OpenAI" mode
   - Enter your API key
   - Select your preferred model
   - Click "Save Settings"

## Development

Run in development mode:
```bash
npm run electron:dev
```

This will:
- Start the Vite dev server on `http://localhost:5173`
- Launch Electron with hot-reload enabled
- Open DevTools automatically

**Note**: The first time you run this, it may take a moment to compile. Make sure `tsx` is installed (`npm install` should handle this).

## Building

Build the application:
```bash
npm run build
```

This builds both:
- Main process (Electron): `dist/main.js` and `dist/preload.js`
- Renderer process (React): `dist/index.html` and `dist/assets/*`

Build macOS app bundle:
```bash
npm run build:mac
```

The built app will be in the `release/` directory as a `.dmg` file.

## Running the Built App

After building, you can run the app directly:
```bash
npm start
```

This runs `electron dist/main.js` which loads the built renderer.

## Troubleshooting

### "Cannot find module" errors
- Make sure you've run `npm install` to install all dependencies
- For development, the app uses `tsx` to run TypeScript directly - ensure it's installed
- If issues persist, try: `npm run build` first, then `npm start`

### Electron won't start
- Check that the Vite dev server is running on port 5173 (for dev mode)
- Make sure no other process is using port 5173
- Try running `npm run dev` in one terminal and `npm start` in another

### Build errors
- Make sure TypeScript compiles: `npm run build:main`
- Check that Vite builds the renderer: `npm run build:renderer`
- The main process uses CommonJS modules, renderer uses ES modules

## Project Structure

```
desktop/
├── src/
│   ├── main/           # Electron main process
│   │   ├── main.ts     # Main entry point (compiled to dist/main.js)
│   │   └── preload.ts  # Preload script (compiled to dist/preload.js)
│   ├── renderer/       # React renderer process
│   │   ├── App.tsx     # Main app component
│   │   ├── main.tsx    # React entry point
│   │   └── index.css   # Global styles
│   ├── lib/            # Shared libraries
│   │   ├── storage.ts  # Electron storage adapter (IPC-based)
│   │   ├── openai.ts   # OpenAI API client
│   │   └── ...
│   ├── agents/         # AI agents
│   │   └── orchestrator.ts
│   ├── tools/          # Tool implementations
│   │   ├── searchDocs.ts
│   │   ├── codeActions.ts
│   │   └── ...
│   └── ui/             # UI components
│       ├── components/
│       ├── icons/
│       └── mascot/
├── dist/               # Build output
│   ├── main.js         # Compiled main process
│   ├── preload.js      # Compiled preload script
│   ├── index.html      # Renderer HTML
│   └── assets/         # Renderer assets (JS, CSS, images)
├── electron-dev.js     # Development entry point (uses tsx)
├── electron-dev-preload.js  # Development preload
├── package.json
├── vite.config.ts      # Vite config (renderer only)
├── tsconfig.json       # TypeScript config (renderer)
└── tsconfig.main.json  # TypeScript config (main process)
```

## Differences from Chrome Extension

- **Storage**: Uses `electron-store` via IPC instead of `chrome.storage`
- **No Page Manipulation**: Desktop app can't manipulate browser pages
- **No DevTools Bridge**: Limited DevTools access (browser DevTools not available)
- **No Content Scripts**: Desktop app runs as standalone window
- **Settings UI**: Built into main app instead of separate options page

## Configuration

### Backend Modes

1. **Proxy Mode** (default):
   - Connects to Next.js API at `http://localhost:3000/api/chat`
   - Requires the Next.js server to be running
   - API key is stored on the server

2. **Direct OpenAI Mode**:
   - Connects directly to OpenAI API
   - Requires your OpenAI API key
   - More secure (key stored locally)
   - Enables tool calling features

## License

Same as the main GameNPC project.
