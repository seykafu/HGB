import { getGame, loadFiles } from './projects'

export async function exportGame(gameId: string, platform: 'mac' | 'win' = 'mac'): Promise<string> {
  const game = await getGame(gameId)
  const files = await loadFiles(gameId)

  // Wait a bit for preload script to be ready (in case of timing issues)
  if (typeof window !== 'undefined' && !window.electronAPI?.export?.exportGame) {
    // Wait up to 1 second for the preload script to load
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 100))
      if (window.electronAPI?.export?.exportGame) {
        break
      }
    }
  }

  // Use IPC to export files in the main process
  if (typeof window !== 'undefined' && window.electronAPI?.export?.exportGame) {
    try {
      const exportDir = await window.electronAPI.export.exportGame({
        gameId,
        gameSlug: game.slug,
        platform,
        files,
      })
      return exportDir
    } catch (error) {
      console.error('Export IPC error:', error)
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Check if we're in Electron but export API isn't available
  if (typeof window !== 'undefined' && window.electronAPI) {
    console.warn('electronAPI exists but export is not available.')
    console.warn('electronAPI structure:', {
      hasStorage: !!window.electronAPI.storage,
      hasEnv: !!window.electronAPI.env,
      hasExport: !!window.electronAPI.export,
    })
    throw new Error('Export API not available. The preload script may not be loaded correctly. Please restart the app.')
  }

  // Fallback: return a message (shouldn't happen in Electron)
  throw new Error('Export functionality requires Electron IPC. Please use the desktop app.')
}

