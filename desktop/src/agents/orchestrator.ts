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

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orchestrator for Himalayan Game Builder, an indie game AI Copilot. Your job is to route user requests to the right tools:

CRITICAL ROUTING RULES:
- If the user asks to "build", "create", "make", "generate", or "design" a GAME (e.g., "build a tic-tac-toe game", "create a simple adventure game", "make me a puzzle game"), you MUST use **buildGame** tool. DO NOT use proposeCode or outputSnippets for game creation requests.
- If the user asks to "fix", "update", "change", "modify", "improve", "add", "remove", "edit", "adjust", or "make pretty" the GAME (e.g., "fix the game", "make it bigger", "update the colors", "make it look pretty", "make it look pretty again"), you MUST use **buildGame** tool with the gameId. DO NOT use proposeCode, outputSnippets, or searchDocs for game modification requests.
- **buildGame** is the ONLY tool that creates and modifies playable games in the Design Board and Preview. It generates Phaser 3 games that run in the browser.
- **proposeCode** and **outputSnippets** are for code examples, documentation, and integration help - NOT for creating or modifying games in this app.
- **searchDocs** is for documentation questions about Unity/Unreal/Frostbite - NOT for modifying games. If the user wants to modify their game, use buildGame.
- NEVER mention Unity when the user asks to modify their game. This is a Phaser 3 game builder, not Unity. The games run in the browser using Phaser 3, not Unity.

Tool descriptions:
1. **buildGame**: PRIMARY tool for game creation AND modification. Use when user asks to BUILD, CREATE, MAKE, FIX, UPDATE, CHANGE, MODIFY, IMPROVE, ADD, or REMOVE features in a game. Generates complete Phaser 3 game code that runs in the preview. When gameId is provided, it will update the existing game.
2. **createScene**: Use when user wants to create a new game scene
3. **addNPC**: Use when user wants to add an NPC to a scene
4. **addDialogue**: Use when user wants to add dialogue nodes
5. **connectNodes**: Use when user wants to connect dialogue nodes
6. **searchDocs**: Use when user asks about APIs, documentation, or "how do I..." questions for Unity/Unreal/Frostbite
7. **proposeCode** or **outputSnippets**: Use ONLY for code examples, documentation, or integration help. NEVER use these for game creation - use buildGame instead.
8. **sendGameAction**: Use when user wants the NPC to do something NOW in the running game
9. **getDevtools**: Use when user mentions errors, console issues, debugging

When buildGame completes successfully, respond with ONLY this brief message: "I've built a basic design for the game and have coded a basic version of this game. The game files have been saved and you can see them in the file tree on the left."

Note: Page manipulation is not available in the desktop app version.

You may call multiple tools in sequence. Always provide a friendly, helpful final answer with citations when using docs.`

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
  
  if (isAnyGameRequest && gameId) {
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
      
      // Generate assets if:
      // 1. It's a new game build request (not a modification), OR
      // 2. It's a build request but no assets exist yet
      const shouldGenerateAssets = (isGameBuildRequest && !isGameModificationRequest) || 
                                   (isGameBuildRequest && existingAssetsCount === 0)
      
      if (shouldGenerateAssets) {
        try {
          // Step 1: Ask gameBuilder to analyze what assets are needed
          onStatusUpdate?.('Analyzing game requirements...')
          const { determineRequiredAssets } = await import('../tools/gameBuilder')
          const requiredAssets = await determineRequiredAssets(gameType, description)
          
          if (requiredAssets.length > 0) {
            console.log(`Himalayan Game Builder: Determined ${requiredAssets.length} required assets:`, requiredAssets.map(a => a.name))
            
            // Step 2: Generate the required assets
            onStatusUpdate?.('Generating game assets with AI...')
            const assetsResult = await generateGameAssets({
              gameId,
              gameType,
              description,
              assets: requiredAssets.map(a => ({
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
          // Continue without assets if generation fails
        }
      } else {
        console.log(`Himalayan Game Builder: Skipping asset generation (isBuildRequest: ${isGameBuildRequest}, isModification: ${isGameModificationRequest}, existingAssets: ${existingAssetsCount})`)
      }
      
      // Proceed with buildGame (with or without assets)
      // Directly call buildGame (it will handle both creation and updates)
      const { buildGame } = await import('../tools/gameBuilder')
      const result = await buildGame({
        gameType,
        description,
        gameId,
        assets: generatedAssets,
      })
      
      if (result.ok) {
        // Return a simple success message stream
        const message = isGameModificationRequest || isAnyGameRequest
          ? "I've updated the game with your requested changes. The game files have been saved and you can see them in the file tree on the left."
          : generatedAssets.length > 0
          ? `I've generated ${generatedAssets.length} game asset(s) and built the game code. The game files have been saved and you can see them in the file tree on the left. Click on the assets folder to view the generated images.`
          : "I've built a basic design for the game and have coded a basic version of this game. The game files have been saved and you can see them in the file tree on the left."
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            let index = 0
            const sendChunk = () => {
              if (index < message.length) {
                controller.enqueue(encoder.encode(message[index]))
                index++
                setTimeout(sendChunk, 20)
              } else {
                controller.close()
              }
            }
            sendChunk()
          },
        })
        return { 
          stream,
          generatedAssets: generatedAssets.length > 0 ? generatedAssets : undefined,
          onAssetsGenerated: onAssetsGenerated
        }
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

  // If this is a game-building or modification request, add explicit instruction to use buildGame
  let systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT
  if (isGameBuildRequest || isGameModificationRequest) {
    if (isGameModificationRequest) {
      systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT + '\n\nCRITICAL: The user is asking to FIX/UPDATE/CHANGE/MODIFY/IMPROVE/MAKE PRETTY the existing game. You MUST use the buildGame tool with the gameId. Do NOT use proposeCode, outputSnippets, or searchDocs. Do NOT give Unity suggestions or documentation. The user wants the actual game code modified, not examples or tutorials. Use buildGame to update the game files with the requested changes. This is a Phaser 3 game, not Unity. NEVER mention Unity in your response.'
    } else {
      systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT + '\n\nCRITICAL: The user is asking to BUILD/CREATE/MAKE a game. You MUST use the buildGame tool. Do NOT use proposeCode or outputSnippets. Use buildGame with gameType and description extracted from the user\'s request.'
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
