// Development entry point for Electron
// This file allows running Electron with TypeScript source files in dev mode

import { app, BrowserWindow, ipcMain } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Store from 'electron-store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const store = new Store() as any

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    backgroundColor: '#F8F1E3',
    webPreferences: {
      preload: join(__dirname, 'electron-dev-preload.ts'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    frame: true,
  })

  // In development, try port 5173 first, then 5174
  const port = process.env.VITE_PORT || '5173'
  mainWindow.loadURL(`http://localhost:${port}`)
  mainWindow.webContents.openDevTools()

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC handlers for storage
ipcMain.handle('storage:get', async (_, key: string, fallback: any) => {
  return store.get(key, fallback)
})

ipcMain.handle('storage:set', async (_, key: string, value: any) => {
  store.set(key, value)
})

ipcMain.handle('storage:getAll', async () => {
  return store.store
})

ipcMain.handle('storage:remove', async (_, key: string) => {
  store.delete(key)
})

// IPC handler for environment variables
ipcMain.handle('env:get', async (_, key: string) => {
  return process.env[key] || null
})

// IPC handler for game export
ipcMain.handle('export:game', async (_, data: {
  gameId: string
  gameSlug: string
  platform: string
  files: Record<string, string>
}) => {
  const { writeFile, mkdir } = await import('fs/promises')
  const { join } = await import('path')
  
  const exportDir = join(app.getPath('userData'), 'exports', data.gameSlug, data.platform)
  
  // Create export directory
  await mkdir(exportDir, { recursive: true })
  
  // Write all files
  for (const [path, content] of Object.entries(data.files)) {
    const filePath = join(exportDir, path)
    const dirPath = join(filePath, '..')
    await mkdir(dirPath, { recursive: true })
    await writeFile(filePath, content, 'utf-8')
  }
  
  // TODO: Bundle Phaser runtime and create executable
  // For now, just export the game files
  
  return exportDir
})

