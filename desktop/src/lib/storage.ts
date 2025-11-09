// Electron storage adapter using electron-store via IPC
declare global {
  interface Window {
    electronAPI?: {
      storage: {
        get: (key: string, fallback: any) => Promise<any>
        set: (key: string, value: any) => Promise<void>
        getAll: () => Promise<Record<string, any>>
        remove: (key: string) => Promise<void>
      }
      env?: {
        get: (key: string) => Promise<string | null>
      }
      export?: {
        exportGame: (data: {
          gameId: string
          gameSlug: string
          platform: string
          files: Record<string, string>
        }) => Promise<string>
      }
      download?: {
        downloadImage: (url: string) => Promise<ArrayBuffer>
      }
    }
  }
}

export const get = <T>(key: string, fallback: T): Promise<T> => {
  if (window.electronAPI) {
    return window.electronAPI.storage.get(key, fallback)
  }
  // Fallback to localStorage for browser compatibility
  try {
    const item = localStorage.getItem(key)
    return Promise.resolve(item ? JSON.parse(item) : fallback)
  } catch {
    return Promise.resolve(fallback)
  }
}

export const set = <T>(key: string, value: T): Promise<void> => {
  if (window.electronAPI) {
    return window.electronAPI.storage.set(key, value)
  }
  // Fallback to localStorage
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return Promise.resolve()
  } catch {
    return Promise.resolve()
  }
}

export const getAll = (): Promise<Record<string, any>> => {
  if (window.electronAPI) {
    return window.electronAPI.storage.getAll()
  }
  // Fallback to localStorage
  const all: Record<string, any> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      try {
        all[key] = JSON.parse(localStorage.getItem(key) || 'null')
      } catch {
        // Skip invalid entries
      }
    }
  }
  return Promise.resolve(all)
}

export const remove = (key: string): Promise<void> => {
  if (window.electronAPI) {
    return window.electronAPI.storage.remove(key)
  }
  localStorage.removeItem(key)
  return Promise.resolve()
}

