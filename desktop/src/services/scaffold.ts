import { createGame, saveFiles } from './projects'
import type { GameScene } from '../game/engine/phaserRuntime'
import type { DialogueGraph } from '../game/narrative/types'

export interface ProjectScaffold {
  gameId: string
  title: string
  slug: string
  scenes: GameScene[]
  dialogue: DialogueGraph
}

export async function scaffoldProject(
  title: string,
  description: string
): Promise<ProjectScaffold> {
  // Generate slug from title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  // Create game record
  const game = await createGame(title, slug)

  // Create default scene
  const defaultScene: GameScene = {
    name: 'town',
    width: 800,
    height: 600,
    objects: [
      {
        type: 'player',
        id: 'player',
        x: 400,
        y: 300,
        sprite: 'player',
      },
    ],
  }

  // Create default dialogue
  const defaultDialogue: DialogueGraph = {
    nodes: [
      {
        id: 'start',
        type: 'line',
        content: 'Welcome to your game!',
        targetId: 'end',
      },
      {
        id: 'end',
        type: 'line',
        content: 'This is just the beginning...',
      },
    ],
    startNodeId: 'start',
  }

  // Save project files
  await saveFiles(game.id, [
    {
      path: 'game.json',
      content: JSON.stringify({
        title,
        slug,
        version: '0.1.0',
        engine: 'phaser3',
      }, null, 2),
    },
    {
      path: 'scenes/town.json',
      content: JSON.stringify(defaultScene, null, 2),
    },
    {
      path: 'dialogue/prologue.yarn.json',
      content: JSON.stringify(defaultDialogue, null, 2),
    },
  ])

  return {
    gameId: game.id,
    title,
    slug,
    scenes: [defaultScene],
    dialogue: defaultDialogue,
  }
}

