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

  let model = await get<string>('model', 'gpt-5')
  
  // Generate a scene class name based on game type (must be defined before use in template strings)
  const sceneClassName = gameType && gameType !== 'game' 
    ? gameType.charAt(0).toUpperCase() + gameType.slice(1).replace(/[-_]/g, '') + 'Scene'
    : 'GameScene'
  
  // Build assets info for the prompt with exact asset names and complete example
  const assetsInfo = assets && assets.length > 0
    ? `\n\n**AVAILABLE ASSETS - YOU MUST USE THESE IN YOUR GAME (DO NOT IGNORE THESE):**
${assets.map(a => `- "${a.name}" (${a.type})`).join('\n')}

**CRITICAL: THESE ARE STATIC PNG IMAGES - NOT ANIMATED SPRITESHEETS**
- All assets are static PNG image files (single frame images)
- DO NOT use this.load.spritesheet() or this.load.atlas() - these are NOT spritesheets
- DO NOT create animations from these assets - they are single static images
- Use this.load.image() to load them as static images
- Use this.add.image() to display them - they will appear as static sprites
- For character movement, you can move the image position, but the image itself won't animate
- If you need animation effects, use Phaser's built-in tweens or physics, but the sprite image itself stays static

**COMPLETE WORKING EXAMPLE - YOU MUST FOLLOW THIS EXACT PATTERN:**

class ${sceneClassName} extends Phaser.Scene {
  preload() {
    // CRITICAL: Access assets from game instance - this is how assets are passed to your scene
    // Assets are stored on the game instance by the runtime
    // Use plain JavaScript (no TypeScript syntax) - assets may be on game.assets or game.config.assets
    const gameAssets = this.sys.game.assets || (this.sys.game.config && this.sys.game.config.assets) || {}
    const assets = gameAssets || {}
    
${assets.map(a => `    // Load ${a.name} asset as STATIC IMAGE (blob URL from game instance)
    // IMPORTANT: This is a static PNG, NOT a spritesheet - use load.image(), NOT load.spritesheet()
    if (assets['${a.name}']) {
      this.load.image('${a.name}', assets['${a.name}'])
    }`).join('\n')}
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    
    // CRITICAL: Add assets ONCE in create() and store references - DO NOT recreate them in update()
    // Assets should remain persistent throughout the game - no flashing or flickering
    
${assets.map((a) => {
  if (a.name.includes('logo')) {
    return `    // Display ${a.name} at top center (static image) - ADD ONCE, store reference if needed
    this.logo = this.add.image(width / 2, 50, '${a.name}').setDisplaySize(100, 100).setOrigin(0.5)`
  } else if (a.name.includes('background')) {
    return `    // Display ${a.name} as background (static image, full screen) - ADD ONCE, keep persistent
    this.background = this.add.image(width / 2, height / 2, '${a.name}').setDisplaySize(width, height).setOrigin(0.5)`
  } else if (a.name.includes('tile')) {
    return `    // Use ${a.name} for game tiles/board (static image) - ADD ONCE per tile, store in array
    // Example: this.tiles = []; for (let i = 0; i < count; i++) { this.tiles.push(this.add.image(x, y, '${a.name}')) }`
  } else if (a.name.includes('marker') || a.name.includes('x_') || a.name.includes('o_')) {
    return `    // Use ${a.name} for game markers/pieces (static image) - ADD ONCE when needed, store reference
    // Example: this.marker = this.add.image(x, y, '${a.name}'); // Store reference, don't recreate`
  } else if (a.name.includes('character') || a.name.includes('player')) {
    return `    // Use ${a.name} for player character (static image) - ADD ONCE, store as this.player
    // CRITICAL: Add once in create(), then only change position in update() - never recreate
    this.player = this.add.image(x, y, '${a.name}').setOrigin(0.5)
    // Move with: this.player.x += speed (in update()), but NEVER recreate this.player`
  } else {
    return `    // Use ${a.name} asset in your game (static image) - ADD ONCE, store reference
    this.${a.name.replace(/[^a-zA-Z0-9]/g, '_')} = this.add.image(x, y, '${a.name}')`
  }
}).join('\n')}
    
    // ... rest of your game code
  }
  
  update() {
    // CRITICAL: In update(), only change positions of existing assets - DO NOT add/remove/recreate assets
    // Example: if (this.player) { this.player.x += speed } - but NEVER do: this.player = this.add.image(...)
  }
}

**CRITICAL REQUIREMENTS - READ CAREFULLY:**
1. You MUST include a preload() method that loads ALL ${assets.length} asset(s) listed above
2. You MUST use ALL ${assets.length} asset(s) in your create() method with this.add.image()
3. DO NOT create placeholder shapes (rectangles, circles, graphics) if assets are available
4. The assets are STATIC PNG IMAGES - use this.load.image(), NOT this.load.spritesheet() or animation methods
5. DO NOT try to create animations from these static images - they are single-frame PNG files
6. The assets are blob URLs stored on the game instance - access via: this.sys.game.assets || (this.sys.game.config && this.sys.game.config.assets) || {}
7. After loading, verify with: if (this.textures.exists('${assets[0]?.name}')) { /* use asset */ }
8. **CRITICAL: PREVENT ASSET FLASHING - DO NOT:**
    - DO NOT add/remove assets in the update() method - assets should only be added ONCE in create()
    - DO NOT recreate assets each frame - store references (e.g., this.player, this.background) and reuse them
    - DO NOT call this.add.image() repeatedly for the same asset - add it once in create() and store the reference
    - DO NOT destroy and recreate assets - keep them persistent throughout the game
    - If an asset needs to move, store it as a property (e.g., this.player = this.add.image(...)) and only change its position, never recreate it
    - Assets should be added ONCE in create() and remain visible - do not toggle visibility rapidly or remove/add them
`
    : ''

  const systemPrompt = `You are an expert Phaser 3 game developer. Generate complete, runnable Phaser 3 game code based on the user's description.

CRITICAL REQUIREMENTS:
1. Generate a complete Phaser 3 Scene class that extends Phaser.Scene
2. The class MUST be named exactly: ${sceneClassName}
3. The class must be wrapped in an IIFE: (function() { ... })()
4. Register the scene class globally: window.${sceneClassName} = ${sceneClassName}
5. Use proper Phaser 3 APIs (this.add, this.input, etc.)
6. Include preload() method if assets are provided
7. Include create() method for initialization
8. Include update() method if the game needs continuous updates
9. Make the game interactive and playable
10. Use this.cameras.main.width and this.cameras.main.height for dimensions
11. **CRITICAL: Generate ONLY plain JavaScript code - NO TypeScript syntax!**
    - DO NOT use TypeScript type assertions like "as any", "as string", etc.
    - DO NOT use TypeScript-specific syntax
    - The code will be executed as plain JavaScript, so use only JavaScript syntax
12. **CRITICAL ASSET USAGE: If assets are provided in the prompt below, you MUST:**
    - **IMPORTANT: All assets are STATIC PNG IMAGES (single-frame images), NOT animated spritesheets**
    - Load ALL assets in preload() method using: const gameAssets = this.sys.game.assets || (this.sys.game.config && this.sys.game.config.assets) || {}; const assets = gameAssets || {}; if (assets['asset_name']) { this.load.image('asset_name', assets['asset_name']) }
    - **DO NOT use this.load.spritesheet() or this.load.atlas() - these are static PNG files, not spritesheets**
    - **DO NOT create animations from these assets - they are single static images**
    - Use ALL assets in create() method (display them with this.add.image(x, y, 'asset_name'))
    - **CRITICAL: PREVENT ASSET FLASHING - Assets must be added ONCE in create() and remain persistent:**
      - Store asset references as class properties (e.g., this.player = this.add.image(...), this.background = this.add.image(...))
      - DO NOT add/remove assets in update() method - only add them ONCE in create()
      - DO NOT recreate assets each frame - reuse stored references
      - DO NOT call this.add.image() repeatedly for the same asset
      - DO NOT destroy and recreate assets - keep them persistent
      - If assets need to move, only change their position (this.player.x, this.player.y), never recreate them
      - Assets should remain visible and stable - no rapid toggling of visibility or removal/addition
    - Characters can move (change position), but the sprite image itself will NOT animate
    - DO NOT create placeholder rectangles, circles, or shapes if assets are available
    - The assets object contains blob URLs that work directly with Phaser's load.image()
    - Asset keys match the names listed in the assets section below
    - **VERIFY**: After loading, you can check if assets loaded with: this.textures.exists('asset_name')

Game Description: ${description}
Game Type: ${gameType}${assetsInfo}

Generate ONLY the JavaScript code, no explanations or markdown. The code should be a complete, runnable Phaser 3 game that uses the provided assets.`

  const userPrompt = `Generate a Phaser 3 game based on this description: "${description}"

Make it a complete, playable game with proper game mechanics, controls, and visual feedback.`

  console.log('Himalayan Game Builder: Calling OpenAI to generate game code...')
  
  // GPT-5 has different parameter requirements
  const isGPT5 = model.toLowerCase().includes('gpt-5')
  const requestBody: any = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  }
  
  if (isGPT5) {
    // GPT-5 only supports default temperature (1), and uses max_completion_tokens
    requestBody.max_completion_tokens = 16000
    // Don't set temperature - GPT-5 only supports default value of 1
  } else {
    requestBody.temperature = 0.7
    requestBody.max_tokens = 16000
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Himalayan Game Builder: OpenAI API error:', response.status, errorText)
    let errorMessage = `OpenAI API error: ${response.status}`
    try {
      const errorData = JSON.parse(errorText)
      errorMessage = errorData.error?.message || errorMessage
      
      // Check for rate limit or quota errors
      if (response.status === 429 || errorData.error?.code === 'insufficient_quota' || 
          errorData.error?.type === 'insufficient_quota' ||
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.toLowerCase().includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please contact kaseyfuwaterloo@gmail.com to use the premium version.'
      }
    } catch {
      // Use default error message
      if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please contact kaseyfuwaterloo@gmail.com to use the premium version.'
      }
    }
    throw new Error(errorMessage)
  }

  const data = await response.json()
  console.log('Himalayan Game Builder: OpenAI API response:', {
    model: data.model,
    choices: data.choices?.length || 0,
    finishReason: data.choices?.[0]?.finish_reason,
    hasContent: !!data.choices?.[0]?.message?.content,
  })
  
  const generatedCode = data.choices?.[0]?.message?.content || ''
  
  if (!generatedCode) {
    console.error('Himalayan Game Builder: Empty response from AI. Full response:', JSON.stringify(data, null, 2))
    throw new Error(`No code generated by AI. Finish reason: ${data.choices?.[0]?.finish_reason || 'unknown'}`)
  }

  // Extract code from markdown code blocks if present
  let code = generatedCode.trim()
  const codeBlockMatch = code.match(/```(?:javascript|js)?\n([\s\S]*?)```/)
  if (codeBlockMatch) {
    code = codeBlockMatch[1].trim()
  }
  
  // Post-process: Remove TypeScript syntax (the code runs as plain JavaScript)
  // Remove all TypeScript type assertions: " as any", " as string", etc.
  // This handles patterns like:
  // - (this.sys.game as any) -> (this.sys.game)
  // - this.sys.game as any -> this.sys.game
  // - (obj as any).prop -> (obj).prop
  // We use a more aggressive regex that matches " as <type>" and removes it
  code = code.replace(/\s+as\s+\w+/g, '')
  
  // Post-process: ALWAYS ensure assets are loaded and used if provided
  if (assets && assets.length > 0) {
    const assetNames = assets.map(a => a.name)
    console.log('Himalayan Game Builder: Post-processing code to ensure assets are loaded and used:', assetNames)
    
    // ALWAYS inject asset loading into preload method (even if one exists)
    const preloadMatch = code.match(/(preload\s*\([^)]*\)\s*\{)/)
    if (preloadMatch) {
      const preloadStart = preloadMatch.index! + preloadMatch[0].length
      
      // Find the end of the preload method (matching braces)
      let braceCount = 1
      let preloadEnd = preloadStart
      for (let i = preloadStart; i < code.length && braceCount > 0; i++) {
        if (code[i] === '{') braceCount++
        if (code[i] === '}') braceCount--
        if (braceCount === 0) {
          preloadEnd = i
          break
        }
      }
      
      const preloadContent = code.substring(preloadStart, preloadEnd)
      
      // Check if gameAssets or assets variables are already declared
      const hasGameAssetsDecl = /(const|let|var)\s+gameAssets\s*=/.test(preloadContent)
      const hasAssetsDecl = /(const|let|var)\s+assets\s*=/.test(preloadContent)
      
      // Check if assets are already being loaded
      const assetsAlreadyLoaded = assetNames.some(name => 
        preloadContent.includes(`assets['${name}']`) || 
        preloadContent.includes(`assets["${name}"]`) ||
        preloadContent.includes(`assets.${name}`) ||
        preloadContent.includes(`this.load.image('${name}'`) ||
        preloadContent.includes(`this.load.image("${name}"`)
      )
      
      if (!assetsAlreadyLoaded) {
        console.log('Himalayan Game Builder: Injecting asset loading code into preload method')
        
        // If gameAssets is already declared, reuse it; otherwise declare it
        let assetLoadingCode = ''
        if (!hasGameAssetsDecl && !hasAssetsDecl) {
          // Neither is declared - declare both
          assetLoadingCode = `\n    // Load assets from game instance (stored by runtime)
    const gameAssets = this.sys.game.assets || (this.sys.game.config && this.sys.game.config.assets) || {}
    const assets = gameAssets || {}\n`
        } else if (hasGameAssetsDecl && !hasAssetsDecl) {
          // gameAssets exists, but assets doesn't - just declare assets
          assetLoadingCode = `\n    // Load assets from game instance
    const assets = gameAssets || {}\n`
        } else if (hasAssetsDecl) {
          // assets already exists - just use it
          assetLoadingCode = `\n    // Load assets from game instance\n`
        }
        
        // Add asset loading code
        assetLoadingCode += assetNames.map(name => `    if (assets['${name}']) {\n      this.load.image('${name}', assets['${name}'])\n    }`).join('\n') + '\n'
        
        code = code.slice(0, preloadStart) + assetLoadingCode + code.slice(preloadStart)
        console.log('Himalayan Game Builder: ✓ Injected asset loading code')
      } else {
        console.log('Himalayan Game Builder: Assets already being loaded in preload method')
      }
    } else {
      // No preload method exists - add one before create()
      console.log('Himalayan Game Builder: No preload method found, adding one before create()')
      const createMatch = code.match(/(create\s*\([^)]*\)\s*\{)/)
      if (createMatch) {
        const createIndex = createMatch.index!
        const assetLoadingCode = `  preload() {
    // Load assets from game instance (stored by runtime)
    const gameAssets = this.sys.game.assets || (this.sys.game.config && this.sys.game.config.assets) || {}
    const assets = gameAssets || {}\n${assetNames.map(name => `    if (assets['${name}']) {\n      this.load.image('${name}', assets['${name}'])\n    }`).join('\n')}
  }

  `
        code = code.slice(0, createIndex) + assetLoadingCode + code.slice(createIndex)
        console.log('Himalayan Game Builder: ✓ Added preload method with asset loading')
      }
    }
    
    // ALWAYS inject asset usage into create method
    const createMatch = code.match(/(create\s*\([^)]*\)\s*\{)/)
    if (createMatch) {
      const createStart = createMatch.index! + createMatch[0].length
      
      // Find the end of the create method (matching braces)
      let createBraceCount = 1
      let createEnd = createStart
      for (let i = createStart; i < code.length && createBraceCount > 0; i++) {
        if (code[i] === '{') createBraceCount++
        if (code[i] === '}') createBraceCount--
        if (createBraceCount === 0) {
          createEnd = i
          break
        }
      }
      const createContent = code.substring(createStart, createEnd > 0 ? createEnd : code.length)
      
      const assetsAlreadyUsed = assetNames.some(name => 
        createContent.includes(`this.add.image`) && (
          createContent.includes(`'${name}'`) || 
          createContent.includes(`"${name}"`)
        )
      )
      
      if (!assetsAlreadyUsed) {
        console.log('Himalayan Game Builder: Injecting asset usage code into create method')
        
        // Always use direct access to avoid any potential variable declaration conflicts
        // This is safer than trying to detect all possible declaration patterns
        const widthRef = 'this.cameras.main.width'
        const heightRef = 'this.cameras.main.height'
        const varDeclarations = '' // No variable declarations needed
        
        const assetUsageCode = `\n    // Display generated assets\n${varDeclarations}${assetNames.map((name) => {
          if (name.includes('logo')) {
            return `    if (this.textures.exists('${name}')) {\n      this.add.image(${widthRef} / 2, 50, '${name}').setDisplaySize(100, 100).setOrigin(0.5)\n    }`
          } else if (name.includes('background')) {
            return `    if (this.textures.exists('${name}')) {\n      this.add.image(${widthRef} / 2, ${heightRef} / 2, '${name}').setDisplaySize(${widthRef}, ${heightRef}).setOrigin(0.5)\n    }`
          } else if (name.includes('tile')) {
            return `    // Use ${name} for game tiles/board\n    // Example: if (this.textures.exists('${name}')) { this.add.image(x, y, '${name}') }`
          } else if (name.includes('marker') || name.includes('x_') || name.includes('o_')) {
            return `    // Use ${name} for game markers/pieces\n    // Example: if (this.textures.exists('${name}')) { this.add.image(x, y, '${name}') }`
          } else {
            return `    // Use ${name} asset\n    // Example: if (this.textures.exists('${name}')) { this.add.image(x, y, '${name}') }`
          }
        }).join('\n')}\n`
        code = code.slice(0, createStart) + assetUsageCode + code.slice(createStart)
        console.log('Himalayan Game Builder: ✓ Injected asset usage code')
      } else {
        console.log('Himalayan Game Builder: Assets already being used in create method')
      }
    }
  }

  // Extract scene name from the code or generate one
  const sceneNameMatch = code.match(/class\s+(\w+Scene)\s+extends/)
  let sceneName = sceneNameMatch ? sceneNameMatch[1].replace('Scene', '').toLowerCase() : gameType.toLowerCase() || 'game'
  let className = sceneNameMatch ? sceneNameMatch[1] : null

  // If no class found, try to use the expected class name
  if (!className) {
    className = sceneClassName
    console.log('GameBuilder: No scene class found in code, using expected name:', className)
  }

  console.log('GameBuilder: Extracted scene name:', sceneName, 'class name:', className)

  // Ensure the code is properly wrapped and registered
  if (!code.includes('(function()')) {
    // Wrap in IIFE if not already wrapped
    code = `(function() {\n${code}\n})()`
  }

  // Check if window registration exists, if not add it
  // Always ensure the expected class name is registered
  const expectedClassName = sceneClassName
  if (!code.includes(`window.${expectedClassName}`)) {
    // Add global registration if not present
    // Try to find the closing of the IIFE and add registration before it
    const lastBraceIndex = code.lastIndexOf('})')
    if (lastBraceIndex > 0) {
      // Insert before the closing }) of the IIFE
      code = code.slice(0, lastBraceIndex) + `  window.${expectedClassName} = ${expectedClassName}\n` + code.slice(lastBraceIndex)
    } else {
      // Fallback: append at the end
      code = code.replace(/(})\(\)$/, `  window.${expectedClassName} = ${expectedClassName}\n$1)()`)
    }
    console.log('GameBuilder: Added window registration for:', expectedClassName)
  }

  // Also register with the extracted className if different
  if (className && className !== expectedClassName && !code.includes(`window.${className}`)) {
    const lastBraceIndex = code.lastIndexOf('})')
    if (lastBraceIndex > 0) {
      code = code.slice(0, lastBraceIndex) + `  window.${className} = ${className}\n` + code.slice(lastBraceIndex)
    }
    console.log('GameBuilder: Also registered alternate class name:', className)
  }

  // Verify the registration is in the code
  if (!code.includes(`window.${expectedClassName}`)) {
    console.warn('GameBuilder: Warning - window registration may be missing for:', expectedClassName)
  }

  return { code, sceneName }
}

/**
 * Analyzes a game request and determines what assets are needed
 * This is called BEFORE asset generation to know what to generate
 */
export async function determineRequiredAssets(
  gameType: string,
  description: string
): Promise<Array<{ type: string; name: string; description: string }>> {
  try {
    let apiKey = await get<string>('openaiKey', '')
    if (!apiKey && typeof window !== 'undefined' && window.electronAPI?.env) {
      const envKey = await window.electronAPI.env.get('OPENAI_API_KEY')
      if (envKey) {
        apiKey = envKey
      }
    }

    if (!apiKey) {
      console.warn('No API key for asset analysis, using defaults')
      return getDefaultAssetsForGameType(gameType)
    }

    let model = await get<string>('model', 'gpt-5')

    const prompt = `You are analyzing a game request to determine what visual assets are needed.

Game Type: ${gameType}
Description: ${description}

List the specific visual assets needed for this game. For example:
- For Pacman: pacman (player character), ghost_red, ghost_blue, ghost_pink, ghost_orange, dot, power_pellet, wall_tile
- For Tic-Tac-Toe: x_marker, o_marker, game_tile
- For Donkey Kong: donkey_kong, mario, barrel, platform, ladder
- For a generic 2D game: player (character), enemy, platform (ground/tiles), background

Return ONLY a JSON array of objects with this structure:
[
  {"type": "sprite", "name": "asset_name", "description": "what this asset is"},
  ...
]

Valid types are: "sprite", "tile", "marker", "icon" (use "sprite" for characters and objects, "tile" for tiles/backgrounds, "marker" for UI markers, "icon" for small icons).

IMPORTANT: Always return at least 2-4 assets. Even for generic games, include:
- A player/character sprite
- At least one other game element (enemy, obstacle, collectible, etc.)
- Optionally: platform/tile, background

Be specific and game-appropriate. Return ONLY valid JSON, no markdown, no explanations.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a game asset analyst. Return only valid JSON arrays.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData: any = {}
      try {
        errorData = JSON.parse(errorText)
      } catch {}
      
      // Check for rate limit or quota errors - throw error instead of silently falling back
      if (response.status === 429 || errorData.error?.code === 'insufficient_quota' || 
          errorData.error?.type === 'insufficient_quota') {
        throw new Error('Rate limit exceeded. Please contact kaseyfuwaterloo@gmail.com to use the premium version.')
      }
      
      console.warn('Asset analysis failed, using defaults')
      return getDefaultAssetsForGameType(gameType)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    // Extract JSON from markdown if present
    let jsonStr = content.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    try {
      const assets = JSON.parse(jsonStr)
      if (Array.isArray(assets) && assets.length > 0) {
        console.log(`Himalayan Game Builder: AI determined ${assets.length} required assets:`, assets.map(a => a.name))
        return assets
      } else {
        console.warn('Himalayan Game Builder: AI returned empty or invalid assets array, using defaults')
      }
    } catch (parseError) {
      console.warn('Failed to parse asset requirements, using defaults:', parseError)
    }

    // Always return default assets as fallback
    const defaultAssets = getDefaultAssetsForGameType(gameType)
    console.log(`Himalayan Game Builder: Using default assets for game type "${gameType}":`, defaultAssets.map(a => a.name))
    return defaultAssets
  } catch (error) {
    console.error('Error determining required assets:', error)
    return getDefaultAssetsForGameType(gameType)
  }
}

/**
 * Fallback function that returns default assets for common game types
 */
function getDefaultAssetsForGameType(gameType: string): Array<{ type: string; name: string; description: string }> {
  const lowerType = gameType.toLowerCase()
  
  if (lowerType.includes('pacman') || lowerType.includes('pac-man')) {
    return [
      { type: 'sprite', name: 'pacman', description: 'Pacman character sprite' },
      { type: 'sprite', name: 'ghost_red', description: 'Red ghost enemy' },
      { type: 'sprite', name: 'ghost_blue', description: 'Blue ghost enemy' },
      { type: 'sprite', name: 'ghost_pink', description: 'Pink ghost enemy' },
      { type: 'sprite', name: 'ghost_orange', description: 'Orange ghost enemy' },
      { type: 'sprite', name: 'dot', description: 'Small dot pellet' },
      { type: 'sprite', name: 'power_pellet', description: 'Power pellet' },
      { type: 'tile', name: 'wall_tile', description: 'Wall tile for maze' },
    ]
  }
  
  if (lowerType.includes('platformer') || lowerType.includes('platform') || lowerType.includes('jump')) {
    return [
      { type: 'sprite', name: 'character', description: 'Player character sprite for jumping' },
      { type: 'tile', name: 'platform', description: 'Platform tile for character to jump on' },
      { type: 'tile', name: 'ground', description: 'Ground tile' },
      { type: 'sprite', name: 'hole', description: 'Hole sprite that character must jump over' },
    ]
  }
  
  if (lowerType.includes('tic') || lowerType.includes('tac') || lowerType.includes('toe')) {
    return [
      { type: 'sprite', name: 'x_marker', description: 'X marker for tic-tac-toe' },
      { type: 'sprite', name: 'o_marker', description: 'O marker for tic-tac-toe' },
      { type: 'sprite', name: 'game_tile', description: 'Game tile/board cell' },
    ]
  }
  
  if (lowerType.includes('donkey') || lowerType.includes('kong')) {
    return [
      { type: 'sprite', name: 'donkey_kong', description: 'Donkey Kong character' },
      { type: 'sprite', name: 'mario', description: 'Mario character' },
      { type: 'sprite', name: 'barrel', description: 'Barrel obstacle' },
      { type: 'sprite', name: 'platform', description: 'Platform tile' },
      { type: 'sprite', name: 'ladder', description: 'Ladder sprite' },
    ]
  }
  
  // Generic defaults - always return at least basic assets for any game
  console.log(`Himalayan Game Builder: No specific defaults for "${gameType}", returning generic game assets`)
  return [
    { type: 'sprite', name: 'player', description: 'Player character sprite' },
    { type: 'sprite', name: 'enemy', description: 'Enemy sprite' },
    { type: 'tile', name: 'platform', description: 'Platform or ground tile' },
    { type: 'tile', name: 'background', description: 'Game background' },
  ]
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
        console.log(`Himalayan Game Builder: Game type changed from ${existingGameType} to ${requestedGameType}, creating new game`)
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
    console.log('Himalayan Game Builder: Modifying existing game code based on:', input.description)
    const originalCode = gameCode
    gameCode = modifyGameCode(gameCode, input.description, sceneName)
    console.log('Himalayan Game Builder: Code modified, length changed from', originalCode.length, 'to', gameCode.length)
  } else {
    // Generate new code using AI (new game or different game type)
    console.log(`Himalayan Game Builder: Generating new game code using AI for: ${input.description}`)
    try {
      const aiGeneratedCode = await generateGameCodeWithAI(input.description, input.gameType, input.assets)
      if (aiGeneratedCode) {
        gameCode = aiGeneratedCode.code
        sceneName = aiGeneratedCode.sceneName
        console.log(`Himalayan Game Builder: Successfully generated ${sceneName} game code using AI`)
      } else {
        throw new Error('AI code generation returned empty result')
      }
    } catch (error) {
      console.warn('Himalayan Game Builder: AI code generation failed, falling back to templates:', error)
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
          // Always update mainScene to the newly generated scene
          gameData.mainScene = sceneName
          // Update game type if it changed
          if (input.gameType) {
            gameData.type = input.gameType
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

  // Build message about assets
  let assetMessage = ''
  if (input.assets && input.assets.length > 0) {
    // Let AI determine what would benefit from animation
    const characterAssets = input.assets.filter(a => 
      a.name.includes('character') || 
      a.name.includes('player') || 
      a.name.includes('pacman') || 
      a.name.includes('mario') ||
      a.name.includes('enemy') ||
      a.name.includes('ghost')
    )
    
    if (characterAssets.length > 0) {
      const assetNames = characterAssets.map(a => a.name).join(', ')
      assetMessage = `\n\n**Note about assets:** I've generated static PNG images for your game (${input.assets.length} asset${input.assets.length > 1 ? 's' : ''} total). While these work great for backgrounds, tiles, and static elements, animated spritesheets would make the game feel more polished - especially for characters like ${assetNames} that move around. For now, the game uses these static images, which means characters will move but their sprites won't animate (no walking/running animations). In the future, animated spritesheets would add that extra polish!`
    } else {
      assetMessage = `\n\n**Note about assets:** I've generated ${input.assets.length} static PNG image${input.assets.length > 1 ? 's' : ''} for your game. These are perfect for static elements like tiles and backgrounds. For characters or moving objects, animated spritesheets would add more visual polish, but the static images work well for now!`
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
    message: `Generated ${input.gameType} game code${input.gameId ? ' and saved files' : ''}.${assetMessage}`,
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
      // Load assets from game instance (stored by runtime)
      const gameAssets = this.sys.game.assets || (this.sys.game.config && this.sys.game.config.assets) || {}
      const assets = gameAssets || {}
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
      // Access assets from game instance (stored by runtime)
      const gameAssets = this.sys.game.assets || (this.sys.game.config && this.sys.game.config.assets) || {}
      const assets = gameAssets || {}
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

