export const get = <T>(key: string, fallback: T): Promise<T> =>
  new Promise((resolve) =>
    chrome.storage.sync.get({ [key]: fallback }, (v) => resolve(v[key]))
  )

export const set = <T>(key: string, value: T): Promise<void> =>
  new Promise((resolve) => chrome.storage.sync.set({ [key]: value }, () => resolve()))

export const getAll = (): Promise<Record<string, any>> =>
  new Promise((resolve) => chrome.storage.sync.get(null, resolve))

export const remove = (key: string): Promise<void> =>
  new Promise((resolve) => chrome.storage.sync.remove(key, () => resolve()))

