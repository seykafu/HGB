import type { ToolResult } from './schema'
import type { GameScene } from '../game/engine/phaserRuntime'
import type { DialogueNode, DialogueGraph } from '../game/narrative/types'
import { saveFiles } from '../services/projects'

// Game builder tools for chat agent
export async function createScene(input: {
  name: string
  theme?: string
  width?: number
  height?: number
}): Promise<ToolResult> {
  const scene: GameScene = {
    name: input.name,
    width: input.width || 800,
    height: input.height || 600,
    objects: [],
  }

  return {
    ok: true,
    data: scene,
    message: `Created scene "${input.name}" (${scene.width}x${scene.height})`,
  }
}

export async function addNPC(input: {
  scene: string
  name: string
  sprite?: string
  x: number
  y: number
  entryDialogueNode?: string
}): Promise<ToolResult> {
  const npc = {
    type: 'npc' as const,
    id: input.name.toLowerCase().replace(/\s+/g, '_'),
    x: input.x,
    y: input.y,
    sprite: input.sprite || 'npc',
    properties: {
      dialogueEntry: input.entryDialogueNode,
    },
  }

  return {
    ok: true,
    data: npc,
    message: `Added NPC "${input.name}" at (${input.x}, ${input.y})`,
  }
}

export async function addDialogue(input: {
  nodeId: string
  type: 'line' | 'choice' | 'jump' | 'setVar'
  content?: string
  choices?: Array<{ text: string; targetId: string }>
  targetId?: string
  variable?: string
  value?: any
}): Promise<ToolResult> {
  const node: DialogueNode = {
    id: input.nodeId,
    type: input.type,
    content: input.content,
    choices: input.choices?.map(c => ({
      text: c.text,
      targetId: c.targetId,
    })),
    targetId: input.targetId,
    variable: input.variable,
    value: input.value,
  }

  return {
    ok: true,
    data: node,
    message: `Created dialogue node "${input.nodeId}" (${input.type})`,
  }
}

export async function connectNodes(input: {
  fromId: string
  toId: string
  condition?: {
    variable: string
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte'
    value: any
  }
}): Promise<ToolResult> {
  return {
    ok: true,
    data: {
      from: input.fromId,
      to: input.toId,
      condition: input.condition,
    },
    message: `Connected "${input.fromId}" → "${input.toId}"`,
  }
}

async function generateGameCodeWithAI(
  description: string,
  gameType: string,
  assets?: Array<{ type: string; name: string; url: string; path: string }>
): Promise<{ code: string; sceneName: string }> {
  const { get } = await import('../lib/storage')
  
  // Get OpenAI API key
  let apiKey = await get<string>('openaiKey', '')
  if (!apiKey && typeof window !== 'undefined' && window.electronAPI?.env) {
    const envKey = await window.electronAPI.env.get('OPENAI_API_KEY')
    if (envKey) {
      apiKey = envKey
    }
  }

  if (!apiKey) {
    throw new Error('OpenAI API key required for AI code generation')
  }

  const model = await get<string>('model', 'gpt-5')
  
  // Build assets info for the prompt
  const assetsInfo = assets && assets.length > 0
    ? `\n\nAvailable assets (use blob URLs from this.sys.game.config.assets):\n${assets.map(a => `- ${a.name} (${a.type}): ${a.path}`).join('\n')}`
    : ''

  const systemPrompt = `You are an expert Phaser 3 game developer. Generate complete, runnable Phaser 3 game code based on the user's description.

Requirements:
1. Generate a complete Phaser 3 Scene class that extends Phaser.Scene
2. The class must be wrapped in an IIFE: (function() { ... })()
3. Register the scene class globally: window.SceneClassName = SceneClassName
4. Use proper Phaser 3 APIs (this.add, this.input, etc.)
5. Include preload() method if assets are provided
6. Include create() method for initialization
7. Include update() method if the game needs continuous updates
8. Make the game interactive and playable
9. Use this.cameras.main.width and this.cameras.main.height for dimensions
10. If assets are provided, load them in preload() using: this.load.image('key', this.sys.game.config.assets['key'])

Game Description: ${description}
Game Type: ${gameType}${assetsInfo}

Generate ONLY the JavaScript code, no explanations or markdown. The code should be a complete, runnable Phaser 3 game.`

  const userPrompt = `Generate a Phaser 3 game based on this description: "${description}"

Make it a complete, playable game with proper game mechanics, controls, and visual feedback.`

  console.log('GameBao: Calling OpenAI to generate game code...')
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('GameBao: OpenAI API error:', response.status, errorText)
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const generatedCode = data.choices?.[0]?.message?.content || ''
  
  if (!generatedCode) {
    throw new Error('No code generated by AI')
  }

  // Extract code from markdown code blocks if present
  let code = generatedCode.trim()
  const codeBlockMatch = code.match(/```(?:javascript|js)?\n([\s\S]*?)```/)
  if (codeBlockMatch) {
    code = codeBlockMatch[1].trim()
  }

  // Extract scene name from the code or generate one
  const sceneNameMatch = code.match(/class\s+(\w+Scene)\s+extends/)
  const sceneName = sceneNameMatch ? sceneNameMatch[1].replace('Scene', '').toLowerCase() : 'game'

  // Ensure the code is properly wrapped and registered
  if (!code.includes('(function()')) {
    // Wrap in IIFE if not already wrapped
    code = `(function() {\n${code}\n})()`
  }

  if (!code.includes('window.')) {
    // Add global registration if not present
    const classNameMatch = code.match(/class\s+(\w+Scene)/)
    if (classNameMatch) {
      const className = classNameMatch[1]
      code = code.replace(/(})\(\)/, `  window.${className} = ${className}\n$1)()`)
    }
  }

  return { code, sceneName }
}

export async function buildGame(input: {
  gameType: string
  description: string
  features?: string[]
  gameId?: string
  assets?: Array<{
    type: string
    name: string
    url: string
    path: string
  }>
}): Promise<ToolResult> {
  // Check if this is an update to an existing game
  let existingFiles: Record<string, string> = {}
  let isUpdate = false
  
  if (input.gameId) {
    try {
      const { loadFiles } = await import('../services/projects')
      existingFiles = await loadFiles(input.gameId)
      isUpdate = Object.keys(existingFiles).length > 0
    } catch (error) {
      // If loading fails, treat as new game
      console.log('No existing files found, creating new game')
    }
  }
  
  // This will generate Phaser 3 game code based on the game type
  // For updates, we'll modify the existing code based on the description
  let gameCode = ''
  let sceneName = 'game'
  
  // Check if this is a different game type than the existing game
  let isDifferentGameType = false
  if (isUpdate && existingFiles['game.json']) {
    try {
      const gameData = JSON.parse(existingFiles['game.json'])
      const existingGameType = (gameData.type || '').toLowerCase()
      const requestedGameType = (input.gameType || '').toLowerCase()
      
      // Check if game types are different
      if (existingGameType && requestedGameType && existingGameType !== requestedGameType) {
        isDifferentGameType = true
        console.log(`GameBao: Game type changed from ${existingGameType} to ${requestedGameType}, creating new game`)
      }
      
      // Only load existing code if it's the same game type
      if (!isDifferentGameType) {
        sceneName = gameData.mainScene || 'ticTacToe'
        const scriptPath = `scripts/${sceneName}.js`
        if (existingFiles[scriptPath]) {
          gameCode = existingFiles[scriptPath]
        }
      }
    } catch (error) {
      console.error('Failed to parse existing game data:', error)
    }
  }
  
  // Generate new or updated code based on game type and description
  // If updating same game type, try to modify existing code
  // If different game type or new game, generate new code
  if (isUpdate && !isDifferentGameType && gameCode && gameCode.trim().length > 0) {
    // Modify existing code based on the description (same game type)
    console.log('GameBao: Modifying existing game code based on:', input.description)
    const originalCode = gameCode
    gameCode = modifyGameCode(gameCode, input.description, sceneName)
    console.log('GameBao: Code modified, length changed from', originalCode.length, 'to', gameCode.length)
  } else {
    // Generate new code using AI (new game or different game type)
    console.log(`GameBao: Generating new game code using AI for: ${input.description}`)
    try {
      const aiGeneratedCode = await generateGameCodeWithAI(input.description, input.gameType, input.assets)
      if (aiGeneratedCode) {
        gameCode = aiGeneratedCode.code
        sceneName = aiGeneratedCode.sceneName
        console.log(`GameBao: Successfully generated ${sceneName} game code using AI`)
      } else {
        throw new Error('AI code generation returned empty result')
      }
    } catch (error) {
      console.warn('GameBao: AI code generation failed, falling back to templates:', error)
      // Fallback to templates if AI generation fails
      if (input.gameType.toLowerCase().includes('tic') || input.gameType.toLowerCase().includes('tac') || input.gameType.toLowerCase().includes('toe') || 
          input.description.toLowerCase().includes('tic') || input.description.toLowerCase().includes('tac') || input.description.toLowerCase().includes('toe')) {
        gameCode = generateTicTacToeCode(input.description, input.assets)
        sceneName = 'ticTacToe'
      } else if (input.gameType.toLowerCase().includes('pacman') || input.gameType.toLowerCase().includes('pac-man') ||
                 input.description.toLowerCase().includes('pacman') || input.description.toLowerCase().includes('pac-man')) {
        gameCode = generatePacmanCode(input.description, input.assets)
        sceneName = 'pacman'
      } else {
        gameCode = generateGenericGameCode(input.description, input.features || [], input.assets)
        sceneName = 'game'
      }
    }
  }

  // Save the game code to files if gameId is provided
  if (input.gameId) {
    try {
      // Load existing game.json if updating
      let gameData: any = {
        mainScene: sceneName,
        type: input.gameType,
        description: input.description,
      }
      
      if (existingFiles['game.json']) {
        try {
          gameData = JSON.parse(existingFiles['game.json'])
          // Update description if provided
          if (input.description) {
            gameData.description = input.description
          }
        } catch (error) {
          // Use new game data
        }
      }

      const sceneConfig = existingFiles[`scenes/${sceneName}.json`] 
        ? JSON.parse(existingFiles[`scenes/${sceneName}.json`])
        : {
            name: sceneName,
            width: 600,
            height: 600,
            objects: [],
          }

      await saveFiles(input.gameId, [
        {
          path: `scenes/${sceneName}.json`,
          content: JSON.stringify(sceneConfig, null, 2),
        },
        {
          path: `scripts/${sceneName}.js`,
          content: gameCode,
        },
        {
          path: `game.json`,
          content: JSON.stringify(gameData, null, 2),
        },
      ])
    } catch (error) {
      console.error('Failed to save game files:', error)
      // Continue anyway - the code is still generated
    }
  }

  return {
    ok: true,
    data: {
      code: gameCode,
      sceneName,
      type: input.gameType,
      gameId: input.gameId,
    },
    message: `Generated ${input.gameType} game code${input.gameId ? ' and saved files' : ''}`,
  }
}

function modifyGameCode(existingCode: string, description: string, sceneName: string): string {
  let modifiedCode = existingCode
  const desc = description.toLowerCase()
  
  // Handle aesthetic improvements (prettier, better, nicer, improve, enhance)
  // Also handle negative feedback (bad, ugly, terrible, etc.) - apply aggressive improvements
  const isNegativeFeedback = desc.includes('bad') || desc.includes('ugly') || desc.includes('terrible') || 
                             desc.includes('awful') || desc.includes('horrible') || desc.includes('worse') ||
                             desc.includes('not good') || desc.includes('not great') || desc.includes('still looks')
  
  if (desc.includes('prettier') || desc.includes('better') || desc.includes('nicer') || 
      desc.includes('improve') || desc.includes('enhance') || desc.includes('beautiful') ||
      desc.includes('look') || desc.includes('style') || desc.includes('design') || isNegativeFeedback) {
    
    // Improve cell appearance with shadows and better colors
    modifiedCode = modifiedCode.replace(
      /const cell = this\.add\.rectangle\(x, y, cellSize - 10, cellSize - 10, 0xffffff, 1\)/g,
      'const cell = this.add.rectangle(x, y, cellSize - 10, cellSize - 10, 0xf5f5f5, 1)'
    )
    
    // Add stroke style if not present
    if (!modifiedCode.includes('.setStrokeStyle(3, 0x4a90e2')) {
      modifiedCode = modifiedCode.replace(
        /\.setStrokeStyle\(2, 0x000000\)/g,
        '.setStrokeStyle(3, 0x4a90e2)'
      )
    }
    
    // Improve status text styling - use simpler pattern matching
    // Replace fontSize and color in status text
    modifiedCode = modifiedCode.replace(/fontSize: '24px'/g, "fontSize: '28px'")
    modifiedCode = modifiedCode.replace(/color: '#000000'/g, "color: '#2c3e50'")
    
    // Add font styling if not present
    if (modifiedCode.includes("this.statusText = this.add.text") && !modifiedCode.includes("fontStyle: 'bold'")) {
      // Find the status text line and add styling
      modifiedCode = modifiedCode.replace(
        /(this\.statusText = this\.add\.text\([^)]+\))(\.setOrigin\(0\.5\))?/g,
        (match, textCall, originCall) => {
          // Check if it already has the styling
          if (match.includes("fontStyle")) return match
          
          // Extract the y position
          const yMatch = match.match(/width \/ 2, (\d+)/)
          const yPos = yMatch ? yMatch[1] : '20'
          
          return `this.statusText = this.add.text(width / 2, ${yPos}, 'Player X Turn', {
        fontSize: '28px',
        color: '#2c3e50',
        fontStyle: 'bold',
        stroke: '#ffffff',
        strokeThickness: 3
      }).setOrigin(0.5)`
        }
      )
    }
    
    // Improve marker colors (more vibrant)
    modifiedCode = modifiedCode.replace(/color: '#ff0000'/g, "color: '#e74c3c'") // Better red
    modifiedCode = modifiedCode.replace(/color: '#0000ff'/g, "color: '#3498db'") // Better blue
    
    // Improve marker font size
    modifiedCode = modifiedCode.replace(/fontSize: '60px'/g, "fontSize: '72px'")
    
    // Improve background color
    modifiedCode = modifiedCode.replace(/backgroundColor: '#87CEEB'/g, "backgroundColor: '#ecf0f1'")
    
    // Improve reset button
    modifiedCode = modifiedCode.replace(
      /this\.add\.rectangle\(width \/ 2, height - 50, 200, 50, 0x4a90e2, 1\)/g,
      'this.add.rectangle(width / 2, height - 50, 220, 55, 0x3498db, 1)'
    )
    
    // If negative feedback, apply more aggressive improvements
    if (isNegativeFeedback) {
      // Make cells even more visually appealing with better spacing
      modifiedCode = modifiedCode.replace(/cellSize - 10/g, 'cellSize - 15') // More spacing between cells
      
      // Add subtle background pattern effect by changing background to a gradient-like color
      modifiedCode = modifiedCode.replace(/backgroundColor: '[^']+'/g, "backgroundColor: '#34495e'") // Darker, more modern background
      
      // Make markers even larger and bolder
      modifiedCode = modifiedCode.replace(/fontSize: '72px'/g, "fontSize: '80px'")
      modifiedCode = modifiedCode.replace(/fontSize: '60px'/g, "fontSize: '80px'")
      
      // Improve cell colors to be more vibrant
      modifiedCode = modifiedCode.replace(/0xf5f5f5/g, '0xffffff') // Back to white but with better borders
      
      // Make borders even more prominent
      modifiedCode = modifiedCode.replace(/\.setStrokeStyle\(3, 0x4a90e2\)/g, '.setStrokeStyle(4, 0x3498db)')
      
      // Improve status text even more
      modifiedCode = modifiedCode.replace(/fontSize: '28px'/g, "fontSize: '32px'")
    }
  }
  
  // Handle text positioning requests
  if (desc.includes('text') && (desc.includes('outside') || desc.includes('above') || desc.includes('move') || desc.includes('position'))) {
    // Move status text higher up (outside the game boxes)
    if (modifiedCode.includes('this.statusText = this.add.text(width / 2, 50')) {
      modifiedCode = modifiedCode.replace(
        /this\.statusText = this\.add\.text\(width \/ 2, 50/g,
        'this.statusText = this.add.text(width / 2, 20'
      )
    } else if (modifiedCode.includes('this.add.text(width / 2, 50')) {
      modifiedCode = modifiedCode.replace(
        /this\.add\.text\(width \/ 2, 50/g,
        'this.add.text(width / 2, 20'
      )
    }
  }
  
  // Handle size modifications
  if (desc.includes('bigger') || desc.includes('larger')) {
    modifiedCode = modifiedCode.replace(/const cellSize = 150/g, 'const cellSize = 180')
  } else if (desc.includes('smaller')) {
    modifiedCode = modifiedCode.replace(/const cellSize = 150/g, 'const cellSize = 120')
  }
  
  // Handle color modifications
  if (desc.includes('color') || desc.includes('colour')) {
    if (desc.includes('red')) {
      modifiedCode = modifiedCode.replace(/color: '#[0-9a-fA-F]{6}'/g, "color: '#e74c3c'")
    } else if (desc.includes('blue')) {
      modifiedCode = modifiedCode.replace(/color: '#[0-9a-fA-F]{6}'/g, "color: '#3498db'")
    }
  }
  
  // Handle adding visual elements (happy face, emoji, icon, etc.)
  if ((desc.includes('happy face') || desc.includes('smiley') || desc.includes('emoji') || 
      (desc.includes('face') && desc.includes('center')) || desc.includes('icon') || desc.includes('symbol')) &&
      (desc.includes('add') || desc.includes('show') || desc.includes('put') || desc.includes('place'))) {
    // Add a happy face in the center square
    // Find where cells are created and add code after the loop
    if (modifiedCode.includes('this.cells.push(cell)') && !modifiedCode.includes('// Add happy face in center square')) {
      // Add code after cells are created to draw a happy face in the center (cell index 4)
      const happyFaceCode = `
      
      // Add happy face in center square
      const centerCell = this.cells[4]
      if (centerCell) {
        // Draw face circle (yellow)
        this.add.circle(centerCell.x, centerCell.y, 30, 0xffeb3b, 1)
        // Draw eyes
        this.add.circle(centerCell.x - 10, centerCell.y - 8, 3, 0x000000, 1)
        this.add.circle(centerCell.x + 10, centerCell.y - 8, 3, 0x000000, 1)
        // Draw smile (using graphics for arc)
        const smile = this.add.graphics()
        smile.lineStyle(3, 0x000000, 1)
        smile.arc(centerCell.x, centerCell.y + 5, 12, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(180), false)
        smile.strokePath()
      }`
      
      // Insert after the cells loop ends, before status text
      // Look for the closing brace of the cells loop
      modifiedCode = modifiedCode.replace(
        /(\s+this\.cells\.push\(cell\)\s+})(\s+})/,
        `$1${happyFaceCode}$2`
      )
      
      // Alternative: insert right after the cells loop
      if (!modifiedCode.includes('// Add happy face in center square')) {
        modifiedCode = modifiedCode.replace(
          /(\s+this\.cells\.push\(cell\)\s+}\s+})(\s+\/\/ Status text)/,
          `$1${happyFaceCode}$2`
        )
      }
    }
  }
  
  // Handle adding text or labels
  if (desc.includes('text') && (desc.includes('add') || desc.includes('show') || desc.includes('display'))) {
    // This is handled by the text positioning logic above
  }
  
  return modifiedCode
}

function generateTicTacToeCode(description?: string, assets?: Array<{ type: string; name: string; url: string; path: string }>): string {
  // Check if description has specific positioning requests
  const desc = (description || '').toLowerCase()
  const statusTextY = (desc.includes('text') && (desc.includes('outside') || desc.includes('above'))) ? 20 : 50
  
  // Find assets
  const xMarkerAsset = assets?.find(a => a.name === 'x_marker')
  const oMarkerAsset = assets?.find(a => a.name === 'o_marker')
  const tileAsset = assets?.find(a => a.name === 'game_tile')
  const logoAsset = assets?.find(a => a.name === 'game_logo')
  
  const hasAssets = xMarkerAsset || oMarkerAsset || tileAsset || logoAsset
  
  // Generate JavaScript (not TypeScript) that can be executed directly
  return `// Tic-Tac-Toe Game for Phaser 3
(function() {
  class TicTacToeScene extends Phaser.Scene {
    constructor() {
      super({ key: 'TicTacToeScene' })
      this.board = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
      this.currentPlayer = 1 // 1 = X, 2 = O
      this.gameOver = false
      this.cells = []
      this.markers = []
      this.statusText = null
    }

    ${hasAssets ? `preload() {
      // Load assets from game config (passed by runtime)
      const assets = this.sys.game.config.assets || {}
      ${xMarkerAsset ? `if (assets.x_marker) {
        this.load.image('x_marker', assets.x_marker)
      }` : ''}
      ${oMarkerAsset ? `if (assets.o_marker) {
        this.load.image('o_marker', assets.o_marker)
      }` : ''}
      ${tileAsset ? `if (assets.game_tile) {
        this.load.image('game_tile', assets.game_tile)
      }` : ''}
      ${logoAsset ? `if (assets.game_logo) {
        this.load.image('game_logo', assets.game_logo)
      }` : ''}
    }

    ` : ''}create() {
      const width = this.cameras.main.width
      const height = this.cameras.main.height
      
      // Draw grid
      const cellSize = 150
      const startX = width / 2 - (cellSize * 1.5)
      const startY = height / 2 - (cellSize * 1.5)

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const x = startX + col * cellSize
          const y = startY + row * cellSize
          
          ${tileAsset ? `const cell = this.add.image(x, y, 'game_tile')
            .setDisplaySize(cellSize - 10, cellSize - 10)
            .setInteractive()` : `const cell = this.add.rectangle(x, y, cellSize - 10, cellSize - 10, 0xffffff, 1)
            .setStrokeStyle(2, 0x000000)
            .setInteractive()`}
          cell.on('pointerdown', () => this.handleCellClick(row, col))
          
          this.cells.push(cell)
        }
      }
      
      ${logoAsset ? `// Game logo
      this.add.image(width / 2, 30, 'game_logo').setDisplaySize(100, 100).setOrigin(0.5)` : ''}

      // Status text (positioned outside the game boxes)
      this.statusText = this.add.text(width / 2, ${statusTextY}, 'Player X Turn', {
        fontSize: '24px',
        color: '#000000'
      }).setOrigin(0.5)

      // Reset button
      this.add.rectangle(width / 2, height - 50, 200, 50, 0x4a90e2, 1)
        .setInteractive()
        .on('pointerdown', () => this.resetGame())
      this.add.text(width / 2, height - 50, 'Reset', {
        fontSize: '20px',
        color: '#ffffff'
      }).setOrigin(0.5)
    }

    handleCellClick(row, col) {
      if (this.gameOver || this.board[row][col] !== 0) return

      this.board[row][col] = this.currentPlayer
      this.updateCell(row, col)
      
      if (this.checkWin()) {
        this.gameOver = true
        const winner = this.currentPlayer === 1 ? 'X' : 'O'
        if (this.statusText) {
          this.statusText.setText('Player ' + winner + ' Wins!')
        }
        return
      }

      if (this.checkDraw()) {
        this.gameOver = true
        if (this.statusText) {
          this.statusText.setText('Draw!')
        }
        return
      }

      this.currentPlayer = this.currentPlayer === 1 ? 2 : 1
      const player = this.currentPlayer === 1 ? 'X' : 'O'
      if (this.statusText) {
        this.statusText.setText('Player ' + player + ' Turn')
      }
    }

    updateCell(row, col) {
      const index = row * 3 + col
      const cell = this.cells[index]
      const cellSize = 150
      
      ${xMarkerAsset && oMarkerAsset ? `// Use image assets for markers
      const markerKey = this.currentPlayer === 1 ? 'x_marker' : 'o_marker'
      const marker = this.add.image(cell.x, cell.y, markerKey)
        .setDisplaySize(cellSize * 0.7, cellSize * 0.7)
        .setOrigin(0.5)
      this.markers.push(marker)` : `// Fallback to text markers
      const marker = this.currentPlayer === 1 ? 'X' : 'O'
      const color = this.currentPlayer === 1 ? '#ff0000' : '#0000ff'
      const text = this.add.text(cell.x, cell.y, marker, {
        fontSize: '60px',
        color: color,
        fontStyle: 'bold'
      }).setOrigin(0.5)
      this.markers.push(text)`}
    }

    checkWin() {
      // Check rows
      for (let row = 0; row < 3; row++) {
        if (this.board[row][0] !== 0 &&
            this.board[row][0] === this.board[row][1] &&
            this.board[row][1] === this.board[row][2]) {
          return true
        }
      }

      // Check columns
      for (let col = 0; col < 3; col++) {
        if (this.board[0][col] !== 0 &&
            this.board[0][col] === this.board[1][col] &&
            this.board[1][col] === this.board[2][col]) {
          return true
        }
      }

      // Check diagonals
      if (this.board[0][0] !== 0 &&
          this.board[0][0] === this.board[1][1] &&
          this.board[1][1] === this.board[2][2]) {
        return true
      }

      if (this.board[0][2] !== 0 &&
          this.board[0][2] === this.board[1][1] &&
          this.board[1][1] === this.board[2][0]) {
        return true
      }

      return false
    }

    checkDraw() {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (this.board[row][col] === 0) {
            return false
          }
        }
      }
      return true
    }

    resetGame() {
      this.board = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
      this.currentPlayer = 1
      this.gameOver = false
      this.markers.forEach(m => m.destroy())
      this.markers = []
      if (this.statusText) {
        this.statusText.setText('Player X Turn')
      }
    }
}

  // Register the scene class globally so Phaser can use it
  window.TicTacToeScene = TicTacToeScene
})()`
}

function generatePacmanCode(description?: string, assets?: Array<{ type: string; name: string; url: string; path: string }>): string {
  const logoAsset = assets?.find(a => a.name === 'game_logo')
  
  return `// Pacman Game for Phaser 3
(function() {
  class PacmanScene extends Phaser.Scene {
    constructor() {
      super({ key: 'PacmanScene' })
      this.pacman = null
      this.direction = 'right'
      this.cursors = null
      this.score = 0
      this.scoreText = null
    }

    ${logoAsset ? `preload() {
      const assets = this.sys.game.config.assets || {}
      if (assets.game_logo) {
        this.load.image('game_logo', assets.game_logo)
      }
    }

    ` : ''}create() {
      const { width, height } = this.cameras.main
      
      // Background (maze-like dark blue)
      this.add.rectangle(width / 2, height / 2, width, height, 0x000033)
      
      ${logoAsset ? `// Game logo
      this.add.image(width / 2, 50, 'game_logo').setDisplaySize(80, 80).setOrigin(0.5)` : ''}
      
      // Create Pacman (yellow circle)
      this.pacman = this.add.circle(width / 2, height / 2, 20, 0xFFFF00, 1)
      this.pacman.setInteractive()
      
      // Score text
      this.scoreText = this.add.text(20, 20, 'Score: 0', {
        fontSize: '24px',
        color: '#FFFFFF',
        fontStyle: 'bold'
      })
      
      // Instructions
      this.add.text(width / 2, height - 30, 'Use Arrow Keys to Move', {
        fontSize: '18px',
        color: '#FFFFFF'
      }).setOrigin(0.5)
      
      // Keyboard controls
      this.cursors = this.input.keyboard.createCursorKeys()
      
      // Add some dots (pellets) for Pacman to collect
      this.dots = []
      for (let i = 0; i < 20; i++) {
        const x = Phaser.Math.Between(50, width - 50)
        const y = Phaser.Math.Between(100, height - 100)
        const dot = this.add.circle(x, y, 5, 0xFFFF00, 1)
        this.dots.push(dot)
      }
    }

    update() {
      if (!this.pacman) return
      
      const speed = 200
      let newX = this.pacman.x
      let newY = this.pacman.y
      
      // Handle movement
      if (this.cursors.left.isDown) {
        newX -= speed * this.game.loop.delta / 1000
        this.direction = 'left'
      } else if (this.cursors.right.isDown) {
        newX += speed * this.game.loop.delta / 1000
        this.direction = 'right'
      } else if (this.cursors.up.isDown) {
        newY -= speed * this.game.loop.delta / 1000
        this.direction = 'up'
      } else if (this.cursors.down.isDown) {
        newY += speed * this.game.loop.delta / 1000
        this.direction = 'down'
      }
      
      // Keep Pacman in bounds
      const { width, height } = this.cameras.main
      newX = Phaser.Math.Clamp(newX, 20, width - 20)
      newY = Phaser.Math.Clamp(newY, 20, height - 20)
      
      this.pacman.setPosition(newX, newY)
      
      // Check for dot collection
      this.dots.forEach((dot, index) => {
        if (dot && Phaser.Geom.Intersects.CircleToCircle(this.pacman.getBounds(), dot.getBounds())) {
          dot.destroy()
          this.dots.splice(index, 1)
          this.score += 10
          if (this.scoreText) {
            this.scoreText.setText('Score: ' + this.score)
          }
        }
      })
      
      // Win condition
      if (this.dots.length === 0 && this.scoreText) {
        this.scoreText.setText('You Win! Score: ' + this.score)
        this.scoreText.setFontSize(32)
        this.scoreText.setPosition(width / 2, height / 2)
        this.scoreText.setOrigin(0.5)
      }
    }
  }

  // Register the scene class globally
  window.PacmanScene = PacmanScene
})()`
}

function generateGenericGameCode(description: string, features: string[], assets?: Array<{ type: string; name: string; url: string; path: string }>): string {
  return `// Game: ${description}
// Features: ${features.join(', ')}
(function() {
  class GameScene extends Phaser.Scene {
    constructor() {
      super({ key: 'GameScene' })
    }

    create() {
      const { width, height } = this.cameras.main
      
      // Background
      this.add.rectangle(width / 2, height / 2, width, height, 0x87CEEB)
      
      // Title
      this.add.text(width / 2, 100, '${description}', {
        fontSize: '32px',
        color: '#000000'
      }).setOrigin(0.5)

      // Game content will be generated based on description
      this.add.text(width / 2, height / 2, 'Game implementation in progress...', {
        fontSize: '20px',
        color: '#000000'
      }).setOrigin(0.5)
    }
  }

  // Register the scene class globally
  window.GameScene = GameScene
})()`
}

export async function saveProject(input: {
  gameId: string
  scenes: GameScene[]
  dialogue: DialogueGraph
}): Promise<ToolResult> {
  // This will be called by the orchestrator after tool calls
  // The actual save happens in the Playground component
  return {
    ok: true,
    data: { gameId: input.gameId },
    message: 'Project changes ready to save',
  }
}

