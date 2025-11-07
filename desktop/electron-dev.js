// Development entry point for Electron
// This file allows running Electron with TypeScript source files in dev mode

import { app, BrowserWindow, ipcMain } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Store from 'electron-store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const store = new Store()

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    backgroundColor: '#F8F1E3',
    webPreferences: {
      preload: join(__dirname, 'electron-dev-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    frame: true,
  })

  // In development, load from Vite dev server
  mainWindow.loadURL('http://localhost:5173')
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

