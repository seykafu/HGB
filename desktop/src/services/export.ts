import { getGame, loadFiles } from './projects'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'

export async function exportGame(gameId: string, platform: 'mac' | 'win' = 'mac'): Promise<string> {
  const game = await getGame(gameId)
  const files = await loadFiles(gameId)

  // Determine export path (use user's home directory for now)
  // In production, use electron's app.getPath('userData')
  const exportDir = join(process.env.HOME || process.env.USERPROFILE || '.', 'GameNPC', 'exports', game.slug, platform)

  // Create export directory
  await mkdir(exportDir, { recursive: true })

  // Write all files
  for (const [path, content] of Object.entries(files)) {
    const filePath = join(exportDir, path)
    const dirPath = join(filePath, '..')
    await mkdir(dirPath, { recursive: true })
    await writeFile(filePath, content, 'utf-8')
  }

  // TODO: Bundle Phaser runtime and create executable
  // For now, just export the game files

  return exportDir
}

