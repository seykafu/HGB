import Phaser from 'phaser'

// Extend window to include custom scene classes
declare global {
  interface Window {
    TicTacToeScene?: typeof Phaser.Scene
    GameScene?: typeof Phaser.Scene
    [key: string]: any
  }
}

export interface GameScene {
  name: string
  width: number
  height: number
  tilemap?: {
    key: string
    tileset: string
    data: number[][]
  }
  objects: Array<{
    type: 'player' | 'npc' | 'trigger' | 'item'
    id: string
    x: number
    y: number
    sprite?: string
    properties?: Record<string, any>
  }>
}

export class PhaserGameRuntime {
  private game: Phaser.Game | null = null
  private scenes: Map<string, GameScene> = new Map()
  private currentSceneName: string | null = null
  private loadedScripts: Set<string> = new Set()

  constructor(private container: HTMLElement) {}

  async loadScene(scene: GameScene): Promise<void> {
    this.scenes.set(scene.name, scene)
  }

  async loadGameScript(scriptCode: string, sceneName: string): Promise<void> {
    // Execute the game script code
    try {
      // Create a function that executes the script in a safe context
      const executeScript = new Function(scriptCode)
      executeScript()
      this.loadedScripts.add(sceneName)
    } catch (error) {
      console.error('Failed to load game script:', error)
      throw error
    }
  }

  async startScene(sceneName: string, customSceneClass?: any, assets?: Record<string, string>): Promise<void> {
    if (this.game) {
      this.game.destroy(true)
    }

    let sceneConfig: Phaser.Types.Core.GameConfig['scene']

    // If we have a custom scene class (from loaded script), use it
    if (customSceneClass) {
      sceneConfig = customSceneClass
    } else if (this.scenes.has(sceneName)) {
      // Otherwise use the scene definition
      const scene = this.scenes.get(sceneName)!
      sceneConfig = {
        preload: this.createPreloadFunction(scene),
        create: this.createCreateFunction(scene),
        update: this.createUpdateFunction(scene),
      }
    } else {
      throw new Error(`Scene "${sceneName}" not found`)
    }

    // Use the container's actual size (600x600 as set in the style)
    // The container will be scrollable if it exceeds the viewport
    const containerWidth = this.container.clientWidth || 600
    const containerHeight = this.container.clientHeight || 600

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: containerWidth,
      height: containerHeight,
      parent: this.container,
      backgroundColor: '#87CEEB',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
      scene: sceneConfig,
      scale: {
        mode: Phaser.Scale.NONE, // Don't scale, use exact size
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      // Pass assets to the game config so scenes can access them
      assets: assets || {},
    } as any

    this.game = new Phaser.Game(config)
    this.currentSceneName = sceneName
  }

  private createPreloadFunction(scene: GameScene) {
    return function (this: Phaser.Scene) {
      // Load placeholder sprites if needed
      // In production, load actual assets
      this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
      this.load.image('npc', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==')
    }
  }

  private createCreateFunction(scene: GameScene) {
    return function (this: Phaser.Scene) {
      // Create objects from scene definition
      scene.objects.forEach((obj) => {
        if (obj.type === 'player' || obj.type === 'npc') {
          const sprite = this.add.sprite(obj.x, obj.y, obj.sprite || 'player')
          sprite.setInteractive()
          
          if (obj.type === 'npc') {
            sprite.on('pointerdown', () => {
              // Trigger dialogue or interaction
              this.events.emit('interact', obj.id)
            })
          }
        }
      })
    }
  }

  private createUpdateFunction(scene: GameScene) {
    return function (this: Phaser.Scene) {
      // Update loop - handle player movement, etc.
    }
  }

  destroy(): void {
    if (this.game) {
      this.game.destroy(true)
      this.game = null
    }
  }

  getCurrentScene(): string | null {
    return this.currentSceneName
  }
}

