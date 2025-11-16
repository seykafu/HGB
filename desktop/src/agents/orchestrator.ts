import { callWithToolsWithCitations } from '../lib/openai-tools'
import { streamFromBackend } from '../lib/openai'
import { get } from '../lib/storage'
import { TOOL_SCHEMAS } from '../tools/schema'
import { searchDocs } from '../tools/searchDocs'
import { proposeCode, outputSnippets } from '../tools/codeActions'
import { sendGameAction } from '../tools/gameBridge'
import { getDevtools } from '../tools/devtoolsBridge'
import { createScene, addNPC, addDialogue, connectNodes, buildGame } from '../tools/gameBuilder'
import { generateGameAssets } from '../tools/imageGenerator'
// Note: manipulatePage is not available in desktop app
import type { ChatMessage } from '../lib/openai'

export type StatusCallback = (status: string) => void

export interface OrchestrateResult {
  stream: ReadableStream<Uint8Array>
  citations?: string[]
  generatedAssets?: Array<{ type: string; name: string; url: string; path: string }> // Assets generated for display
  onAssetsGenerated?: () => void // Callback when assets are generated
}

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orchestrator for Himalayan Game Builder, an indie game AI Copilot. Your job is to route user requests to the right tools and ALWAYS BUILD/CREATE/GENERATE things rather than just showing code examples.

CRITICAL ROUTING RULES - ALWAYS TAKE ACTION:
- **NEVER just paste code in chat or show code examples when the user wants something built.** You MUST use tools to actually BUILD, CREATE, GENERATE, or MODIFY things.
- **LISTEN CAREFULLY to the user's prompt** - understand exactly what they want and implement it precisely. Don't add features they didn't ask for unless you're offering suggestions.
- If the user asks to "build", "create", "make", "generate", or "design" a GAME (e.g., "build a tic-tac-toe game", "create a simple adventure game", "make me a puzzle game"), you MUST use **buildGame** tool. DO NOT use proposeCode or outputSnippets for game creation requests. DO NOT just show code - actually build it.
- If the user asks to "fix", "update", "change", "modify", "improve", "add", "remove", "edit", "adjust", or "make pretty" the GAME (e.g., "fix the game", "make it bigger", "update the colors", "make it look pretty", "make it look pretty again"), you MUST use **buildGame** tool with the gameId. DO NOT use proposeCode, outputSnippets, or searchDocs for game modification requests. DO NOT just show code - actually modify the game.
- **buildGame** is the ONLY tool that creates and modifies playable games in the Design Board and Preview. It generates Phaser 3 games that run in the browser. When you use buildGame, the code is automatically saved and the game runs in the preview.
- **generateGameAssets** is used to create image assets for games. Use this when assets are needed for a new game.
- **proposeCode** and **outputSnippets** are ONLY for showing code examples when the user explicitly asks "how do I..." or "show me an example" for documentation purposes. NEVER use these when the user wants something actually built or modified - use buildGame instead.
- **searchDocs** is for documentation questions about Unity/Unreal/Frostbite - NOT for modifying games. If the user wants to modify their game, use buildGame.
- NEVER mention Unity when the user asks to modify their game. This is a Phaser 3 game builder, not Unity. The games run in the browser using Phaser 3, not Unity.
- **When in doubt, use buildGame.** If the user wants something done to their game, use buildGame. If they want assets created, use generateGameAssets. Only use proposeCode/outputSnippets if they explicitly ask for a code example or documentation.

ENGAGING CONVERSATION FLOW - ASK CLARIFYING QUESTIONS:
- **For NEW game builds (first prompt):** Before building, ask clarifying questions to understand what the user wants:
  - What type of game? (platformer, puzzle, adventure, etc.)
  - What are the controls? (WASD, arrow keys, mouse, etc.)
  - What's the main objective or goal?
  - What style/theme? (fantasy, sci-fi, modern, etc.)
  - Any specific features they want? (enemies, collectibles, levels, etc.)
- **You can do PARTIAL builds while asking questions:**
  - If you have enough info to generate basic assets, use **generateGameAssets** first, then ask remaining questions
  - If you have enough info to create basic code structure, you can start with **buildGame** but let the user know you have more questions
  - After partial builds, say: "I've started building the game with what I know so far. Before I finalize the preview, I have a few more questions: [ask questions]"
- **If the user says "fill in the gaps yourself" or "use your best judgment" or similar:** Proceed with building the game using reasonable defaults
- **If you have enough information to build a complete game:** Go ahead and build it, then offer suggestions for improvements
- **Be conversational and engaging** - make the user feel like you're collaborating with them, not just executing commands

INTERACTIVE BEHAVIOR - BE PROACTIVE AND HELPFUL:
- After completing a game build or modification, **offer helpful suggestions** to improve the game. For example:
  - "Would you like me to add another level to the game?"
  - "I could add sound effects or background music to make it more engaging."
  - "Would you like me to add a scoring system or leaderboard?"
  - "I could add more enemies or obstacles to increase the difficulty."
  - "Would you like me to add power-ups or collectibles?"
- **Listen to the user's specific requests** - if they ask for something specific, implement exactly that. Don't add extra features unless offering them as suggestions.
- **Be conversational and helpful** - after building something, engage with the user about what they might want next.

Tool descriptions:
1. **generateGameAssets**: Use to generate image assets (sprites, tiles, markers, logos, backgrounds) for games. This actually creates and saves image files.
2. **buildGame**: PRIMARY tool for game creation AND modification. Use when user asks to BUILD, CREATE, MAKE, FIX, UPDATE, CHANGE, MODIFY, IMPROVE, ADD, or REMOVE features in a game. Generates complete Phaser 3 game code that runs in the preview. When gameId is provided, it will update the existing game. This actually saves code files and makes the game playable.
3. **createScene**: Use when user wants to create a new game scene
4. **addNPC**: Use when user wants to add an NPC to a scene
5. **addDialogue**: Use when user wants to add dialogue nodes
6. **connectNodes**: Use when user wants to connect dialogue nodes
7. **searchDocs**: Use when user asks about APIs, documentation, or "how do I..." questions for Unity/Unreal/Frostbite
8. **proposeCode** or **outputSnippets**: Use ONLY when user explicitly asks for code examples, documentation, or "show me how to..." questions. NEVER use these for game creation or modification - use buildGame instead.
9. **sendGameAction**: Use when user wants the NPC to do something NOW in the running game
10. **getDevtools**: Use when user mentions errors, console issues, debugging

When buildGame completes successfully, respond with a brief message about what was built, then offer helpful suggestions for improvements.

When generateGameAssets completes successfully, respond with: "I've generated the game assets. The image files have been saved and you can see them in the assets folder in the file tree on the left."

Note: Page manipulation is not available in the desktop app version.

You may call multiple tools in sequence. Always provide a friendly, helpful final answer with citations when using docs. Remember: ALWAYS BUILD things rather than just showing code, and be proactive in offering helpful suggestions to improve the game.`

const FALLBACK_SYSTEM_PROMPT = `You are a helpful assistant for indie game developers. Help users with:
- Unity/Unreal/Frostbite documentation questions
- Code generation for NPC agents
- Debugging game issues
- Game actions and NPC behavior

Provide clear, practical answers with code examples when relevant.`

const TOOL_STATUS_MESSAGES: Record<string, string> = {
  buildGame: 'Building game...',
  createScene: 'Creating scene...',
  addNPC: 'Adding NPC...',
  addDialogue: 'Adding dialogue...',
  connectNodes: 'Connecting nodes...',
  searchDocs: 'Analyzing documents...',
  proposeCode: 'Generating code...',
  outputSnippets: 'Generating code...',
  sendGameAction: 'Sending game action...',
  getDevtools: 'Debugging...',
}

export async function orchestrate(
  userText: string,
  conversationHistory: ChatMessage[] = [],
  onStatusUpdate?: StatusCallback,
  gameId?: string | null,
  onAssetsGenerated?: () => void
): Promise<OrchestrateResult> {
  onStatusUpdate?.('Thinking...')
  
  // Track generated assets across the function
  let generatedAssets: Array<{ type: string; name: string; url: string; path: string }> = []

  // Pre-check: If this is clearly a game-building or modification request, force buildGame tool call
  // Match patterns like: "build a game", "create tic tac toe", "make me a puzzle game", etc.
  // Also match modification requests: "fix the game", "update the game", "change the game", "modify", "improve", "add", "remove", etc.
  const isGameBuildRequest = /(build|create|make|generate|design|code|program).*(game|tic.*tac|puzzle|adventure|platformer|rpg|snake|pong|breakout|maze)/i.test(userText) ||
                             /(game|tic.*tac|puzzle|adventure).*(build|create|make|generate|design|code|program)/i.test(userText)
  
  // Detect game modification requests (when gameId exists, user is modifying existing game)
  // This includes requests about UI elements, text, colors, sizes, positions, etc.
  // Also includes negative feedback that implies the game needs improvement
  // CRITICAL: If gameId exists, be very aggressive about catching modification requests
  const isGameModificationRequest = gameId && (
    // Direct modification verbs
    /(fix|update|change|modify|improve|add|remove|edit|adjust|tweak|enhance|refactor|debug|move|position|place|make|set).*(game|it|this|the game|text|box|boxes|button|color|size|bigger|smaller|outside|inside|above|below|left|right|pretty|nice|good|better)/i.test(userText) ||
    /(game|it|this|text|box|boxes|button|player|turn|status).*(fix|update|change|modify|improve|add|remove|edit|adjust|tweak|enhance|refactor|debug|move|position|place|make|set|outside|inside|above|below|left|right|pretty|nice|good|better)/i.test(userText) ||
    /(make|set|change|update|move|position).*(bigger|smaller|faster|slower|different|better|more|less|outside|inside|above|below|left|right|up|down|pretty|nice|good|better|prettier)/i.test(userText) ||
    /(can you|please|could you).*(make|change|update|fix|move|adjust)/i.test(userText) ||
    // Negative feedback
    /(it|this|game|looks?|appears?|seems?).*(bad|ugly|terrible|awful|horrible|worse|not good|not great|needs?.*improve|needs?.*fix|needs?.*change|needs?.*better)/i.test(userText) ||
    /(still|still looks?|still seems?).*(bad|ugly|terrible|awful|horrible|worse|not good|not great)/i.test(userText) ||
    /(looks?|appears?|seems?).*(bad|ugly|terrible|awful|horrible|worse|not good|not great|off|wrong|weird|strange)/i.test(userText) ||
    // Positive improvement requests
    /(make|make it|make the).*(pretty|prettier|nice|nicer|better|good|beautiful|attractive|appealing|modern|clean|polished)/i.test(userText) ||
    /(look|looks|looking).*(pretty|prettier|nice|nicer|better|good|beautiful|attractive|appealing|modern|clean|polished)/i.test(userText) ||
    /(again|one more|once more)/i.test(userText) && /(make|change|improve|update|fix|pretty|better|nice)/i.test(userText)
  )
  
  // Handle game building or modification requests
  // CRITICAL: If gameId exists and this looks like ANY game-related request, force buildGame
  // Be very aggressive about catching modification requests to prevent Unity/docs suggestions
  const isAnyGameRequest = gameId && (
    isGameBuildRequest || 
    isGameModificationRequest ||
    // Catch almost anything that could be a game modification when gameId exists
    /(add|show|put|place|create|draw|display|make|change|update|fix|modify|improve|remove|delete|move|position)/i.test(userText)
  )
  
  // Check if this is the first message (new game build)
  const isFirstMessage = conversationHistory.length === 0 || 
                         (conversationHistory.length === 1 && conversationHistory[0].role === 'system')
  const isFirstGameBuild = isFirstMessage && isGameBuildRequest && !gameId
  
  // For first-time game builds, don't force direct buildGame - let AI ask questions first
  if (isAnyGameRequest && gameId && !isFirstGameBuild) {
    if (isGameBuildRequest) {
      console.log('Himalayan Game Builder: Detected game-building request, forcing multi-modal workflow')
      onStatusUpdate?.('Generating game assets...')
    } else {
      console.log('Himalayan Game Builder: Detected game modification request, forcing buildGame tool')
      onStatusUpdate?.('Updating game...')
    }
    
    try {
      // For modifications, we'll use buildGame with the modification description
      // buildGame will handle loading existing files and updating them
      let gameType = 'game'
      let description = userText
      
      // Try to detect game type from user text
      if (/tic.*tac.*toe/i.test(userText)) {
        gameType = 'tic-tac-toe'
      } else if (/pac.*man|pacman/i.test(userText)) {
        gameType = 'pacman'
      } else if (/snake/i.test(userText)) {
        gameType = 'snake'
      } else if (/puzzle/i.test(userText)) {
        gameType = 'puzzle'
      } else if (/adventure/i.test(userText)) {
        gameType = 'adventure'
      } else if (/platformer|platform/i.test(userText)) {
        gameType = 'platformer'
      } else if (/shooter|shoot/i.test(userText)) {
        gameType = 'shooter'
      } else {
        // Extract game type from description (e.g., "build me a small pacman game" -> "pacman")
        const gameTypeMatch = userText.match(/(?:build|create|make|generate|design).*?(?:a|an|the)?\s*([a-z]+)\s+game/i)
        if (gameTypeMatch && gameTypeMatch[1]) {
          gameType = gameTypeMatch[1]
          console.log(`Himalayan Game Builder: Detected game type from description: ${gameType}`)
        }
      }
      
      // For NEW game builds OR if no assets exist, determine required assets first, then generate them
      // Check if assets already exist
      let existingAssetsCount = 0
      if (gameId) {
        try {
          const { listFilePaths } = await import('../services/projects')
          const existingFiles = await listFilePaths(gameId)
          existingAssetsCount = existingFiles.filter(p => p.startsWith('assets/')).length
          console.log(`Himalayan Game Builder: Found ${existingAssetsCount} existing assets for game`)
        } catch (error) {
          console.warn('Himalayan Game Builder: Could not check existing assets:', error)
        }
      }
      
      // Check if user wants to regenerate specific assets (e.g., "regenerate the background", "regenerate background", "new background")
      const regenerateAssetPatterns = [
        /regenerate\s+(?:the\s+)?(background|sprite|tile|marker|logo|icon|asset|assets)/i,
        /new\s+(?:the\s+)?(background|sprite|tile|marker|logo|icon|asset|assets)/i,
        /replace\s+(?:the\s+)?(background|sprite|tile|marker|logo|icon|asset|assets)/i,
        /generate\s+(?:a\s+)?(?:new\s+)?(background|sprite|tile|marker|logo|icon|asset|assets)/i,
      ]
      
      let requestedAssetType: string | null = null
      for (const pattern of regenerateAssetPatterns) {
        const match = userText.match(pattern)
        if (match && match[1]) {
          requestedAssetType = match[1].toLowerCase()
          console.log(`Himalayan Game Builder: Detected request to regenerate ${requestedAssetType}`)
          break
        }
      }
      
      // Generate assets if:
      // 1. It's a new game build request (not a modification), OR
      // 2. It's a build request but no assets exist yet, OR
      // 3. User explicitly requested to regenerate specific assets
      const shouldGenerateAssets = (isGameBuildRequest && !isGameModificationRequest) || 
                                   (isGameBuildRequest && existingAssetsCount === 0) ||
                                   (requestedAssetType !== null && gameId)
      
      if (shouldGenerateAssets) {
        try {
          let assetsToGenerate: Array<{ type: string; name: string; description: string }> = []
          
          if (requestedAssetType && gameId) {
            // User requested to regenerate specific assets
            onStatusUpdate?.(`Regenerating ${requestedAssetType} asset...`)
            
            // Get existing assets to find matching ones
            try {
              const { listFilePaths, loadFiles } = await import('../services/projects')
              const existingFiles = await listFilePaths(gameId)
              const existingAssetPaths = existingFiles.filter(p => p.startsWith('assets/'))
              
              // Get kept assets from storage
              const { get } = await import('../lib/storage')
              const keptAssetsKey = `keptAssets_${gameId}`
              const keptAssets = new Set(await get<string[]>(keptAssetsKey, []))
              
              // Filter assets by type and exclude kept ones
              const matchingAssets = existingAssetPaths
                .filter(path => {
                  const assetName = path.replace('assets/', '').replace(/\.(png|jpg|jpeg)$/i, '')
                  // Check if asset name or path matches the requested type
                  const matchesType = assetName.toLowerCase().includes(requestedAssetType) ||
                                    path.toLowerCase().includes(requestedAssetType)
                  // Exclude if marked as "keep"
                  const isKept = keptAssets.has(path)
                  return matchesType && !isKept
                })
              
              if (matchingAssets.length > 0) {
                // Generate replacements for matching assets
                const files = await loadFiles(gameId)
                for (const assetPath of matchingAssets) {
                  const assetName = assetPath.replace('assets/', '').replace(/\.(png|jpg|jpeg)$/i, '')
                  // Determine asset type from name
                  let assetType: 'tile' | 'marker' | 'logo' | 'background' | 'sprite' | 'icon' = 'sprite'
                  if (assetName.includes('background') || assetName.includes('bg')) {
                    assetType = 'background'
                  } else if (assetName.includes('tile')) {
                    assetType = 'tile'
                  } else if (assetName.includes('marker')) {
                    assetType = 'marker'
                  } else if (assetName.includes('logo')) {
                    assetType = 'logo'
                  } else if (assetName.includes('icon')) {
                    assetType = 'icon'
                  }
                  
                  assetsToGenerate.push({
                    type: assetType,
                    name: assetName,
                    description: `A ${requestedAssetType} asset for the game`
                  })
                }
                console.log(`Himalayan Game Builder: Will regenerate ${assetsToGenerate.length} ${requestedAssetType} asset(s)`)
              } else {
                // No matching assets found, generate a new one
                let assetType: 'tile' | 'marker' | 'logo' | 'background' | 'sprite' | 'icon' = 'sprite'
                if (requestedAssetType === 'background' || requestedAssetType.includes('background')) {
                  assetType = 'background'
                } else if (requestedAssetType === 'tile') {
                  assetType = 'tile'
                } else if (requestedAssetType === 'marker') {
                  assetType = 'marker'
                } else if (requestedAssetType === 'logo') {
                  assetType = 'logo'
                } else if (requestedAssetType === 'icon') {
                  assetType = 'icon'
                }
                
                assetsToGenerate.push({
                  type: assetType,
                  name: `game_${requestedAssetType}`,
                  description: `A ${requestedAssetType} asset for the game`
                })
                console.log(`Himalayan Game Builder: Will generate new ${requestedAssetType} asset`)
              }
            } catch (error) {
              console.error('Himalayan Game Builder: Error finding assets to regenerate:', error)
              // Fallback: generate a new asset of the requested type
              let assetType: 'tile' | 'marker' | 'logo' | 'background' | 'sprite' | 'icon' = 'sprite'
              if (requestedAssetType === 'background' || requestedAssetType.includes('background')) {
                assetType = 'background'
              }
              assetsToGenerate.push({
                type: assetType,
                name: `game_${requestedAssetType}`,
                description: `A ${requestedAssetType} asset for the game`
              })
            }
          } else {
            // Step 1: Ask gameBuilder to analyze what assets are needed
            onStatusUpdate?.('Analyzing game requirements...')
            const { determineRequiredAssets } = await import('../tools/gameBuilder')
            assetsToGenerate = await determineRequiredAssets(gameType, description)
          }
          
          if (assetsToGenerate.length > 0) {
            // Limit to maximum 10 assets per prompt
            const limitedAssets = assetsToGenerate.slice(0, 10)
            if (assetsToGenerate.length > 10) {
              console.log(`Himalayan Game Builder: Limiting assets from ${assetsToGenerate.length} to 10 (maximum allowed)`)
            }
            console.log(`Himalayan Game Builder: Determined ${limitedAssets.length} required assets:`, limitedAssets.map(a => a.name))
            
            // Step 2: Generate the required assets
            onStatusUpdate?.('Generating game assets with AI...')
            const assetsResult = await generateGameAssets({
              gameId,
              gameType,
              description,
              assets: limitedAssets.map(a => ({
                type: (a.type as 'tile' | 'marker' | 'logo' | 'background' | 'sprite' | 'icon') || 'sprite',
                name: a.name,
                description: a.description,
              })),
            })
            
            if (assetsResult.ok && assetsResult.data?.assets) {
              generatedAssets = assetsResult.data.assets
              console.log(`Himalayan Game Builder: Generated ${generatedAssets.length} assets for game`)
              console.log(`Himalayan Game Builder: Asset paths:`, generatedAssets.map(a => a.path))
              onStatusUpdate?.('Assets generated! Building game...')
              // Assets are now saved to game_files table - trigger refresh callback
              if (onAssetsGenerated) {
                console.log('Himalayan Game Builder: Triggering file tree refresh callback')
                onAssetsGenerated()
              }
            } else {
              console.warn('Himalayan Game Builder: Asset generation failed, continuing without assets')
              console.warn('Himalayan Game Builder: Asset generation result:', assetsResult)
              if (assetsResult.error) {
                console.error('Himalayan Game Builder: Asset generation error details:', assetsResult.error)
              }
            }
          } else {
            console.log('Himalayan Game Builder: No assets required for this game type')
          }
        } catch (error) {
          console.error('Himalayan Game Builder: Asset generation error:', error)
          // If it's a rate limit error, propagate it to the user
          if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
            throw error
          }
          // Continue without assets if generation fails for other reasons
        }
      } else {
        console.log(`Himalayan Game Builder: Skipping asset generation (isBuildRequest: ${isGameBuildRequest}, isModification: ${isGameModificationRequest}, existingAssets: ${existingAssetsCount})`)
      }
      
      // Collect all assets for buildGame (newly generated + existing kept assets)
      let allAssets = [...generatedAssets]
      if (gameId) {
        try {
          const { loadFiles } = await import('../services/projects')
          const { get } = await import('../lib/storage')
          const files = await loadFiles(gameId)
          
          // Get kept assets from storage
          const keptAssetsKey = `keptAssets_${gameId}`
          const keptAssets = new Set(await get<string[]>(keptAssetsKey, []))
          
          // Add existing assets that are marked as "keep" and not already in generatedAssets
          const existingAssetPaths = Object.keys(files).filter(p => p.startsWith('assets/') && (p.endsWith('.png') || p.endsWith('.jpg') || p.endsWith('.jpeg')))
          const generatedAssetPaths = new Set(generatedAssets.map(a => a.path))
          
          for (const assetPath of existingAssetPaths) {
            if (keptAssets.has(assetPath) && !generatedAssetPaths.has(assetPath)) {
              const assetName = assetPath.replace('assets/', '').replace(/\.(png|jpg|jpeg)$/i, '')
              allAssets.push({
                type: 'sprite', // Default type, will be determined by buildGame if needed
                name: assetName,
                url: files[assetPath],
                path: assetPath,
              })
            }
          }
          
          console.log(`Himalayan Game Builder: Including ${allAssets.length - generatedAssets.length} kept assets in game build`)
        } catch (error) {
          console.warn('Himalayan Game Builder: Could not load existing assets for build:', error)
        }
      }
      
      // Proceed with buildGame (with or without assets)
      // Directly call buildGame (it will handle both creation and updates)
      const { buildGame } = await import('../tools/gameBuilder')
      const result = await buildGame({
        gameType,
        description,
        gameId,
        assets: allAssets,
      })
      
      if (result.ok) {
        // Generate a simple completion message, then let the AI add suggestions in the tool calling response
        const baseMessage = isGameModificationRequest || isAnyGameRequest
          ? "I've updated the game with your requested changes. The game files have been saved and you can see them in the file tree on the left."
          : generatedAssets.length > 0
          ? `I've generated ${generatedAssets.length} game asset(s) and built the game code. The game files have been saved and you can see them in the file tree on the left. Click on the assets folder to view the generated images.`
          : "I've built a basic design for the game and have coded a basic version of this game. The game files have been saved and you can see them in the file tree on the left."
        
        // Continue to tool calling so the AI can add helpful suggestions
        // Don't return early - let the tool calling system generate a more interactive response
        console.log('Himalayan Game Builder: Game built successfully, continuing to tool calling for interactive response')
      }
    } catch (error) {
      console.error('Direct buildGame call failed:', error)
      // Fall through to normal orchestration
    }
  }
  
  // Helper function to determine what assets are needed for a game type
  function determineAssetsForGameType(gameType: string, description: string): Array<{
    type: 'tile' | 'marker' | 'logo' | 'background' | 'sprite' | 'icon'
    name: string
    description: string
    size?: { width: number; height: number }
  }> {
    const assets: Array<{
      type: 'tile' | 'marker' | 'logo' | 'background' | 'sprite' | 'icon'
      name: string
      description: string
      size?: { width: number; height: number }
    }> = []
    
    const lowerType = gameType.toLowerCase()
    const lowerDesc = description.toLowerCase()
    
    // Tic-tac-toe specific assets
    if (lowerType.includes('tic') || lowerType.includes('tac') || lowerType.includes('toe') ||
        lowerDesc.includes('tic') || lowerDesc.includes('tac') || lowerDesc.includes('toe')) {
      assets.push(
        {
          type: 'marker',
          name: 'x_marker',
          description: 'A bold X marker for tic-tac-toe, simple and clear, suitable for game board',
          size: { width: 128, height: 128 },
        },
        {
          type: 'marker',
          name: 'o_marker',
          description: 'A bold O marker for tic-tac-toe, simple and clear, suitable for game board',
          size: { width: 128, height: 128 },
        },
        {
          type: 'tile',
          name: 'game_tile',
          description: 'A clean square tile for tic-tac-toe game board, subtle border, light background',
          size: { width: 150, height: 150 },
        },
        {
          type: 'logo',
          name: 'game_logo',
          description: 'A cute game logo for tic-tac-toe game, playful and fun',
          size: { width: 256, height: 256 },
        }
      )
    } else {
      // Generic game assets
      assets.push(
        {
          type: 'logo',
          name: 'game_logo',
          description: `A game logo for ${gameType} game, matching the theme: ${description}`,
          size: { width: 256, height: 256 },
        },
        {
          type: 'background',
          name: 'game_background',
          description: `A game background for ${gameType} game, matching the theme: ${description}`,
          size: { width: 800, height: 600 },
        }
      )
    }
    
    return assets
  }

  // Check if we have OpenAI API key for tool calling
  // Try storage first, then fall back to environment variable
  let key = await get<string>('openaiKey', '')
  if (!key && typeof window !== 'undefined' && window.electronAPI?.env) {
    const envKey = await window.electronAPI.env.get('OPENAI_API_KEY')
    if (envKey) {
      key = envKey
      console.log('Himalayan Game Builder Desktop: Using OPENAI_API_KEY from environment variable in orchestrator')
    }
  }
  const backendMode = await get<string>('backendMode', 'direct')
  
  // If no API key or in proxy mode, use regular streaming (fallback)
  // But we can still try to use searchDocs directly for documentation questions
  // IMPORTANT: Don't use searchDocs if this is a game modification request
  const isDocQuestion = !isGameModificationRequest && /(how|what|where|when|why|documentation|api|unity|unreal|frostbite|guide|tutorial|help|learn)/i.test(userText)
  
  if (!key || backendMode === 'proxy') {
    console.log('Himalayan Game Builder: Using fallback mode (no tool calling)')
    
    // If it's a documentation question, try to use searchDocs directly
    if (isDocQuestion) {
      try {
        onStatusUpdate?.('Analyzing documents...')
        console.log('Himalayan Game Builder: Detected doc question, using searchDocs directly')
        // Infer engine from query
        let engine: 'unity' | 'unreal' | 'frostbite' | 'auto' = 'auto'
        if (/unity/i.test(userText)) engine = 'unity'
        else if (/unreal/i.test(userText)) engine = 'unreal'
        else if (/frostbite/i.test(userText)) engine = 'frostbite'

        const searchResult = await searchDocs({ query: userText, engine })
        if (searchResult.ok && searchResult.citations && searchResult.citations.length > 0) {
          // Use the search result as the answer
          const answer = searchResult.data?.answer || searchResult.message || 'No documentation found.'
          const citations = searchResult.citations
          
          onStatusUpdate?.('Processing response...')
          
          // Create a stream from the answer content
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              let index = 0
              const sendChunk = () => {
                if (index < answer.length) {
                  controller.enqueue(encoder.encode(answer[index]))
                  index++
                  setTimeout(sendChunk, 10)
                } else {
                  controller.close()
                }
              }
              sendChunk()
            },
          })
          
          return { stream, citations, generatedAssets: generatedAssets.length > 0 ? generatedAssets : undefined, onAssetsGenerated }
        }
      } catch (error) {
        console.warn('Himalayan Game Builder: Direct searchDocs failed, falling back to regular mode:', error)
      }
    }
    
    // Regular fallback
    onStatusUpdate?.('Processing...')
    const messages: ChatMessage[] = [
      { role: 'system', content: FALLBACK_SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: userText },
    ]
    
    const stream = await streamFromBackend(messages)
    if (!stream) {
      throw new Error('Failed to get response from backend')
    }
    return { stream, generatedAssets: generatedAssets.length > 0 ? generatedAssets : undefined, onAssetsGenerated }
  }

  // Tool calling mode (requires OpenAI API key)
  // Note: manipulatePage is excluded for desktop app
  // If this is a modification request, prioritize game builder tools and deprioritize code/docs tools
  const tools = isGameModificationRequest ? [
    TOOL_SCHEMAS.buildGame, // MUST be first - primary tool for game creation/modification
    TOOL_SCHEMAS.createScene,
    TOOL_SCHEMAS.addNPC,
    TOOL_SCHEMAS.addDialogue,
    TOOL_SCHEMAS.connectNodes,
    TOOL_SCHEMAS.sendGameAction,
    TOOL_SCHEMAS.getDevtools,
    // Put code/docs tools last for modification requests to discourage their use
    TOOL_SCHEMAS.searchDocs,
    TOOL_SCHEMAS.proposeCode,
    TOOL_SCHEMAS.outputSnippets,
  ] : [
    TOOL_SCHEMAS.generateGameAssets, // Generate assets FIRST for new games
    TOOL_SCHEMAS.buildGame, // MUST be second - primary tool for game creation
    TOOL_SCHEMAS.createScene,
    TOOL_SCHEMAS.addNPC,
    TOOL_SCHEMAS.addDialogue,
    TOOL_SCHEMAS.connectNodes,
    TOOL_SCHEMAS.searchDocs,
    TOOL_SCHEMAS.proposeCode,
    TOOL_SCHEMAS.outputSnippets,
    TOOL_SCHEMAS.sendGameAction,
    TOOL_SCHEMAS.getDevtools,
  ]

  const toolHandlers: Record<string, (args: any) => Promise<any>> = {
    generateGameAssets: async (args) => {
      onStatusUpdate?.('Generating game assets with AI...')
      const result = await generateGameAssets({ ...args, gameId: gameId || args.gameId })
      return result
    },
    buildGame: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.buildGame)
      const result = await buildGame({ ...args, gameId: gameId || undefined })
      return result
    },
    createScene: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.createScene)
      const result = await createScene(args)
      return result
    },
    addNPC: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.addNPC)
      const result = await addNPC(args)
      return result
    },
    addDialogue: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.addDialogue)
      const result = await addDialogue(args)
      return result
    },
    connectNodes: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.connectNodes)
      const result = await connectNodes(args)
      return result
    },
    searchDocs: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.searchDocs)
      const result = await searchDocs(args)
      return result
    },
    proposeCode: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.proposeCode)
      const result = await proposeCode(args)
      return result
    },
    outputSnippets: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.outputSnippets)
      const result = await outputSnippets(args)
      return result
    },
    sendGameAction: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.sendGameAction)
      const result = await sendGameAction(args)
      return result
    },
    getDevtools: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.getDevtools)
      const result = await getDevtools(args)
      return result
    },
  }

  // Check if this is the first message (new game build) - needed for system prompt
  const isFirstMessageForPrompt = conversationHistory.length === 0 || 
                                   (conversationHistory.length === 1 && conversationHistory[0].role === 'system')
  const isFirstGameBuildForPrompt = isFirstMessageForPrompt && isGameBuildRequest && !gameId
  
  // If this is a game-building or modification request, add explicit instruction to use buildGame
  let systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT
  if (isGameBuildRequest || isGameModificationRequest) {
    if (isGameModificationRequest) {
      systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT + '\n\nCRITICAL: The user is asking to FIX/UPDATE/CHANGE/MODIFY/IMPROVE/MAKE PRETTY the existing game. You MUST use the buildGame tool with the gameId to actually modify the game code. Do NOT use proposeCode, outputSnippets, or searchDocs. Do NOT just show code examples or paste code in chat. Do NOT give Unity suggestions or documentation. The user wants the actual game code modified and saved, not examples or tutorials. Use buildGame to update the game files with the requested changes. This is a Phaser 3 game, not Unity. NEVER mention Unity in your response. ALWAYS BUILD/MODIFY things rather than just showing code.'
    } else if (isFirstGameBuildForPrompt) {
      // First-time game build - ask clarifying questions first
      systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT + '\n\nCRITICAL: This is the FIRST PROMPT for a NEW game build. Before building, you MUST ask clarifying questions to understand what the user wants:\n' +
        '- What type of game? (platformer, puzzle, adventure, etc.)\n' +
        '- What are the controls? (WASD, arrow keys, mouse, etc.)\n' +
        '- What\'s the main objective or goal?\n' +
        '- What style/theme? (fantasy, sci-fi, modern, etc.)\n' +
        '- Any specific features? (enemies, collectibles, levels, etc.)\n\n' +
        'You can do PARTIAL builds while asking questions:\n' +
        '- If you have enough info to generate basic assets, use generateGameAssets first, then ask remaining questions\n' +
        '- If you have enough info to create basic code structure, you can start with buildGame but let the user know you have more questions\n' +
        '- After partial builds, say: "I\'ve started building the game with what I know so far. Before I finalize the preview, I have a few more questions: [ask questions]"\n\n' +
        'If the user says "fill in the gaps yourself" or "use your best judgment", proceed with building using reasonable defaults.\n' +
        'If you have enough information to build a complete game, go ahead and build it, then offer suggestions for improvements.\n\n' +
        'DO NOT just start building without asking questions first - be engaging and collaborative!'
    } else {
      systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT + '\n\nCRITICAL: The user is asking to BUILD/CREATE/MAKE a game. You MUST use the buildGame tool to actually build the game code. Do NOT use proposeCode or outputSnippets. Do NOT just show code examples or paste code in chat. Use buildGame with gameType and description extracted from the user\'s request. The buildGame tool will save the code files and make the game playable. ALWAYS BUILD things rather than just showing code.'
    }
  }

  // Build messages array with full conversation history
  // If the last message in conversationHistory is already the current user message, don't duplicate it
  const lastMessage = conversationHistory[conversationHistory.length - 1]
  const isUserMessageAlreadyIncluded = lastMessage?.role === 'user' && lastMessage?.content === userText
  
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    // Only add userText if it's not already the last message in conversationHistory
    ...(isUserMessageAlreadyIncluded ? [] : [{ role: 'user', content: userText }]),
  ]

  try {
    const collectedCitations: string[] = []
    
    const stream = await callWithToolsWithCitations(
      messages, 
      tools, 
      toolHandlers,
      collectedCitations,
      0,
      onStatusUpdate
    )
    
    if (!stream) {
      throw new Error('Failed to get response from orchestrator')
    }

    return { 
      stream,
      citations: collectedCitations.length > 0 ? collectedCitations : undefined,
      generatedAssets: generatedAssets.length > 0 ? generatedAssets : undefined,
      onAssetsGenerated
    }
  } catch (error) {
    // If tool calling fails, fallback to regular streaming
    console.warn('Himalayan Game Builder: Tool calling failed, falling back to regular mode:', error)
    onStatusUpdate?.('Processing...')
    // Build fallback messages with full conversation history
    const lastMessage = conversationHistory[conversationHistory.length - 1]
    const isUserMessageAlreadyIncluded = lastMessage?.role === 'user' && lastMessage?.content === userText
    
    const fallbackMessages: ChatMessage[] = [
      { role: 'system', content: FALLBACK_SYSTEM_PROMPT },
      ...conversationHistory,
      // Only add userText if it's not already the last message in conversationHistory
      ...(isUserMessageAlreadyIncluded ? [] : [{ role: 'user', content: userText }]),
    ]
    
    const stream = await streamFromBackend(fallbackMessages)
    if (!stream) {
      throw new Error('Failed to get response from backend')
    }
    return { stream, generatedAssets: generatedAssets.length > 0 ? generatedAssets : undefined, onAssetsGenerated }
  }
}
