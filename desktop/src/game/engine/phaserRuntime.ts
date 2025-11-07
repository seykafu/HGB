import Phaser from 'phaser'

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

  constructor(private container: HTMLElement) {}

  async loadScene(scene: GameScene): Promise<void> {
    this.scenes.set(scene.name, scene)
  }

  async startScene(sceneName: string): Promise<void> {
    if (!this.scenes.has(sceneName)) {
      throw new Error(`Scene "${sceneName}" not found`)
    }

    const scene = this.scenes.get(sceneName)!

    if (this.game) {
      this.game.destroy(true)
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: scene.width,
      height: scene.height,
      parent: this.container,
      backgroundColor: '#87CEEB', // Sky blue default
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
      scene: {
        preload: this.createPreloadFunction(scene),
        create: this.createCreateFunction(scene),
        update: this.createUpdateFunction(scene),
      },
    }

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

