import Phaser from 'phaser'

// Extend Phaser config to include assets
declare global {
  namespace Phaser.Types.Core {
    interface GameConfig {
      assets?: Record<string, string>
    }
  }
}

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
      console.log('PhaserRuntime: Loading game script for scene:', sceneName)
      console.log('PhaserRuntime: Script code length:', scriptCode.length)
      
      // Clean up TypeScript syntax from existing files (code runs as plain JavaScript)
      // Remove all TypeScript type assertions: " as any", " as string", etc.
      // Use multiple passes to catch different patterns
      let cleanedCode = scriptCode
      
      // Count matches before cleaning
      const beforeMatches = (scriptCode.match(/\s+as\s+\w+/g) || []).length
      if (beforeMatches > 0) {
        console.log(`PhaserRuntime: Found ${beforeMatches} TypeScript type assertions, cleaning...`)
      }
      
      // Pattern 1: Remove " as <type>" (most common pattern)
      // This matches: " as any", " as string", " as number", etc.
      // This is the primary pattern for TypeScript type assertions
      cleanedCode = cleanedCode.replace(/\s+as\s+\w+/g, '')
      
      // Pattern 2: Remove "(expr as <type>)" -> "(expr)"
      // Handle cases where the assertion is inside parentheses
      cleanedCode = cleanedCode.replace(/\(([^()]+)\s+as\s+\w+\)/g, '($1)')
      
      // Pattern 3: Remove nested patterns like "((expr as <type>).prop)"
      // Handle double parentheses
      cleanedCode = cleanedCode.replace(/\(\(([^()]+)\s+as\s+\w+\)/g, '(($1)')
      
      // Final pass: Remove any remaining " as <type>" patterns that might have been missed
      cleanedCode = cleanedCode.replace(/\s+as\s+\w+/g, '')
      
      // Log if we made any changes
      const afterMatches = (cleanedCode.match(/\s+as\s+\w+/g) || []).length
      if (beforeMatches > 0 || afterMatches > 0) {
        console.log(`PhaserRuntime: Cleaned TypeScript syntax - before: ${beforeMatches}, after: ${afterMatches}`)
        if (afterMatches > 0) {
          console.warn(`PhaserRuntime: Warning: ${afterMatches} TypeScript assertions still remain after cleaning`)
        }
      }
      
      // Create a function that executes the script in a safe context
      const executeScript = new Function(cleanedCode)
      executeScript()
      this.loadedScripts.add(sceneName)
      
      // Log what scene classes are now available
      const availableScenes = Object.keys(window).filter(key => key.endsWith('Scene'))
      console.log('PhaserRuntime: Available scene classes after loading:', availableScenes)
    } catch (error) {
      console.error('PhaserRuntime: Failed to load game script:', error)
      console.error('PhaserRuntime: Script code (first 500 chars):', scriptCode.substring(0, 500))
      // Also log the cleaned code to see if cleaning worked
      try {
        const cleanedCode = scriptCode.replace(/\s+as\s+\w+/g, '').replace(/\(([^()]+)\s+as\s+\w+\)/g, '($1)')
        console.error('PhaserRuntime: Cleaned code (first 500 chars):', cleanedCode.substring(0, 500))
      } catch {}
      throw error
    }
  }

  async startScene(sceneName: string, customSceneClass?: any, assets?: Record<string, string>): Promise<void> {
    console.log('PhaserRuntime: Starting scene:', sceneName, 'with custom class:', !!customSceneClass, 'assets:', Object.keys(assets || {}).length)
    if (assets && Object.keys(assets).length > 0) {
      console.log('PhaserRuntime: Asset keys:', Object.keys(assets))
      console.log('PhaserRuntime: Asset URLs (first 100 chars each):', Object.fromEntries(
        Object.entries(assets).map(([key, url]) => [key, url.substring(0, 100) + '...'])
      ))
    }
    
    // Destroy existing game and clear container
    if (this.game) {
      this.game.destroy(true)
      this.game = null
    }
    
    // Clear any existing canvas elements from the container and body
    if (this.container) {
      // Remove all children from container
      while (this.container.firstChild) {
        this.container.removeChild(this.container.firstChild)
      }
    }
    
    // Also check body for any orphaned Phaser canvases and remove them
    const bodyCanvases = document.body.querySelectorAll('canvas')
    bodyCanvases.forEach(canvas => {
      // Remove any canvas that's a direct child of body (orphaned Phaser canvas)
      if (canvas.parentElement === document.body) {
        canvas.remove()
      }
    })

    let sceneConfig: Phaser.Types.Core.GameConfig['scene']

    // If we have a custom scene class (from loaded script), use it
    if (customSceneClass) {
      console.log('PhaserRuntime: Using custom scene class:', customSceneClass.name || 'unnamed')
      sceneConfig = customSceneClass
    } else if (this.scenes.has(sceneName)) {
      // Otherwise use the scene definition
      console.log('PhaserRuntime: Using scene definition for:', sceneName)
      const scene = this.scenes.get(sceneName)!
      sceneConfig = {
        preload: this.createPreloadFunction(scene),
        create: this.createCreateFunction(scene),
        update: this.createUpdateFunction(scene),
      }
    } else {
      console.error('PhaserRuntime: Scene not found:', sceneName)
      console.error('PhaserRuntime: Available scenes:', Array.from(this.scenes.keys()))
      console.error('PhaserRuntime: Available window scene classes:', Object.keys(window).filter(k => k.endsWith('Scene')))
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
      // Prevent Phaser from creating elements outside the container
      dom: {
        createContainer: false
      }
    } as any
    
    // Log assets being passed to Phaser
    if (assets && Object.keys(assets).length > 0) {
      console.log('PhaserRuntime: Will store assets on game instance:', Object.keys(assets))
      console.log('PhaserRuntime: Assets will be accessible via: (this.sys.game as any).assets')
    } else {
      console.warn('PhaserRuntime: No assets provided')
    }

    try {
      this.game = new Phaser.Game(config)
      this.currentSceneName = sceneName
      console.log('PhaserRuntime: Game started successfully')
      
      // Store assets on the game instance so scenes can access them
      // Phaser doesn't preserve arbitrary config properties, so we store them directly on the game
      if (assets && Object.keys(assets).length > 0) {
        // Store assets on the game instance
        ;(this.game as any).assets = assets
        // Also try to store in config (may not work, but worth trying)
        ;(this.game.config as any).assets = assets
        
        console.log('PhaserRuntime: Stored assets on game instance:', Object.keys(assets))
        console.log('PhaserRuntime: Assets accessible via: this.sys.game.assets or this.sys.game.config.assets')
        
        // Also store in a global for easy access during debugging
        ;(window as any).__phaserAssets = assets
      }
      
      // Verify canvas is in the correct container after a brief delay
      setTimeout(() => {
        const containerCanvas = this.container?.querySelector('canvas')
        // Check if there are any canvases in the body that shouldn't be there
        const bodyCanvases = Array.from(document.body.querySelectorAll('canvas'))
        bodyCanvases.forEach(canvas => {
          // If this canvas is a direct child of body and we have a container canvas, remove it
          if (canvas.parentElement === document.body && containerCanvas && canvas !== containerCanvas) {
            console.warn('PhaserRuntime: Removing orphaned canvas from body')
            canvas.remove()
          }
        })
        
        // Verify assets are accessible in the scene
        if (assets && Object.keys(assets).length > 0 && this.game) {
          const scene = this.game.scene.getScene(sceneName)
          if (scene) {
            const configAssets = (this.game.config as any).assets || {}
            console.log('PhaserRuntime: Assets in game config:', Object.keys(configAssets))
            console.log('PhaserRuntime: Scene can access assets via: this.sys.game.config.assets')
          }
        }
      }, 100)
    } catch (error) {
      console.error('PhaserRuntime: Failed to start Phaser game:', error)
      throw error
    }
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

