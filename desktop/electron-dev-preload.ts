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
  env: {
    get: (key: string) => ipcRenderer.invoke('env:get', key),
  },
  export: {
    exportGame: (data: { gameId: string; gameSlug: string; platform: string; files: Record<string, string> }) =>
      ipcRenderer.invoke('export:game', data),
  },
})

