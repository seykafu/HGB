// Development preload script
// In production, this would be built from src/main/preload.ts

import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  storage: {
    get: (key: string, fallback: any) => ipcRenderer.invoke('storage:get', key, fallback),
    set: (key: string, value: any) => ipcRenderer.invoke('storage:set', key, value),
    getAll: () => ipcRenderer.invoke('storage:getAll'),
    remove: (key: string) => ipcRenderer.invoke('storage:remove', key),
  },
})

