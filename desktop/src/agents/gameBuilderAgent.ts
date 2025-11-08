import { callWithToolsWithCitations } from '../lib/openai-tools'
import { get } from '../lib/storage'
import { TOOL_SCHEMAS } from '../tools/schema'
import { createScene, addNPC, addDialogue, connectNodes, buildGame } from '../tools/gameBuilder'
import type { ChatMessage } from '../lib/openai'

const GAME_BUILDER_SYSTEM_PROMPT = `You are a Game Builder Agent specialized in creating 2D narrative games using Phaser 3.

Your job is to:
1. Analyze user requests for game creation (e.g., "Build a tic-tac-toe game", "Create a simple adventure game")
2. Design the game structure (scenes, objects, interactions)
3. Generate game code using the buildGame tool
4. Create all necessary files (scenes, dialogue, game logic)

Available tools:
- **createScene**: Create a new game scene with dimensions and theme
- **addNPC**: Add NPCs to scenes
- **addDialogue**: Create dialogue nodes
- **connectNodes**: Connect dialogue nodes
- **buildGame**: Generate complete game code with Phaser 3 implementation

When building games:
- For simple games like tic-tac-toe, create a single scene with game logic
- For narrative games, create scenes with NPCs and dialogue
- Always use buildGame to generate the actual Phaser 3 code
- Generate complete, runnable game code

Example workflow for "Build a tic-tac-toe game":
1. Create a scene called "game" (600x600)
2. Use buildGame to generate the tic-tac-toe Phaser 3 code
3. The code should include: game board, X/O markers, win detection, turn switching

Always provide clear feedback about what you're building.`

export async function buildGameFromPrompt(
  userPrompt: string,
  gameId: string,
  conversationHistory: ChatMessage[] = []
): Promise<{
  stream: ReadableStream<Uint8Array>
  gameFiles?: Record<string, string>
  scenes?: any[]
}> {
  // Check if we have OpenAI API key
  let key = await get<string>('openaiKey', '')
  if (!key && typeof window !== 'undefined' && window.electronAPI?.env) {
    const envKey = await window.electronAPI.env.get('OPENAI_API_KEY')
    if (envKey) {
      key = envKey
    }
  }

  if (!key) {
    throw new Error('OpenAI API key required for game building. Please set it in Settings.')
  }

  const tools = [
    {
      name: 'createScene',
      description: 'Create a new 2D game scene with a specified name, theme, and size.',
      parameters: TOOL_SCHEMAS.CreateSceneInputSchema,
    },
    {
      name: 'addNPC',
      description: 'Add a non-player character (NPC) to a specific scene with a sprite, position, and entry dialogue node.',
      parameters: TOOL_SCHEMAS.AddNpcInputSchema,
    },
    {
      name: 'addDialogue',
      description: 'Add a dialogue node (line, choice, jump, setVar, condition) to the dialogue graph.',
      parameters: TOOL_SCHEMAS.AddDialogueInputSchema,
    },
    {
      name: 'connectNodes',
      description: 'Connect two dialogue nodes in the dialogue graph, optionally with a condition.',
      parameters: TOOL_SCHEMAS.ConnectNodesInputSchema,
    },
    {
      name: 'buildGame',
      description: 'Generate complete Phaser 3 game code for a game. This is the main tool for creating playable games.',
      parameters: TOOL_SCHEMAS.BuildGameInputSchema,
    },
  ]

  const toolHandlers = {
    createScene: async (args: any) => createScene(args),
    addNPC: async (args: any) => addNPC(args),
    addDialogue: async (args: any) => addDialogue(args),
    connectNodes: async (args: any) => connectNodes(args),
    buildGame: async (args: any) => buildGame(args, gameId),
  }

  const citations: string[] = []
  const stream = await callWithToolsWithCitations(
    [
      { role: 'system', content: GAME_BUILDER_SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: userPrompt },
    ],
    tools,
    toolHandlers,
    citations,
    0,
    undefined
  )

  if (!stream) {
    throw new Error('Failed to generate game')
  }

  // Extract game files from tool results (we'll need to modify the tool calling to capture this)
  return { stream }
}

