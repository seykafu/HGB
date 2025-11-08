// Tool schemas - same as extension but without manipulatePage for desktop app
export type Engine = 'unity' | 'unreal' | 'frostbite' | 'auto'

export interface SearchDocsInput {
  query: string
  engine: Engine
}

export interface CodeActionInput {
  goal: string
  framework: 'unity' | 'unreal' | 'frostbite' | 'web'
  files?: string[]
}

export interface GameActionInput {
  action: 'say' | 'walk' | 'emote'
  args: Record<string, any>
}

export interface DevtoolsQueryInput {
  kind: 'logs' | 'errors' | 'network'
  filter?: string
}

export interface CreateSceneInput {
  name: string
  theme?: string
  width?: number
  height?: number
}

export interface AddNpcInput {
  scene: string
  name: string
  sprite?: string
  x: number
  y: number
  entryDialogueNode?: string
}

export interface AddDialogueInput {
  nodeId: string
  type: 'line' | 'choice' | 'jump' | 'setVar'
  content?: string
  choices?: Array<{ text: string; targetId: string }>
  targetId?: string
  variable?: string
  value?: any
}

export interface ConnectNodesInput {
  fromId: string
  toId: string
  condition?: {
    variable: string
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte'
    value: any
  }
}

export interface BuildGameInput {
  gameType: string
  description: string
  features?: string[]
  assets?: Array<{
    type: string
    name: string
    url: string
    path: string
  }>
}

export interface GenerateAssetsInput {
  gameId: string
  gameType: string
  description: string
  assets: Array<{
    type: 'tile' | 'marker' | 'logo' | 'background' | 'sprite' | 'icon'
    name: string
    description: string
    size?: { width: number; height: number }
  }>
}

export interface ToolResult {
  ok: boolean
  data?: any
  message?: string
  citations?: string[]
}

export const SearchDocsInputSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'The search query' },
    engine: { 
      type: 'string', 
      enum: ['unity', 'unreal', 'frostbite', 'auto'],
      description: 'The game engine to search. Use "auto" if not specified.' 
    },
  },
  required: ['query'],
}

export const CodeActionInputSchema = {
  type: 'object',
  properties: {
    goal: { type: 'string', description: 'What the code should accomplish' },
    framework: { 
      type: 'string', 
      enum: ['unity', 'unreal', 'frostbite', 'web'],
      description: 'The target framework' 
    },
    files: { 
      type: 'array', 
      items: { type: 'string' },
      description: 'Optional list of specific files to modify' 
    },
  },
  required: ['goal', 'framework'],
}

export const GameActionInputSchema = {
  type: 'object',
  properties: {
    action: { 
      type: 'string', 
      enum: ['say', 'walk', 'emote'],
      description: 'The game action type' 
    },
    args: { 
      type: 'object',
      description: 'Action-specific arguments (e.g., {text: "Hello"} for say, {x: 10, y: 20} for walk)' 
    },
  },
  required: ['action', 'args'],
}

export const DevtoolsQueryInputSchema = {
  type: 'object',
  properties: {
    kind: { 
      type: 'string', 
      enum: ['logs', 'errors', 'network'],
      description: 'The type of DevTools data to fetch' 
    },
    filter: { 
      type: 'string', 
      description: 'Optional filter string' 
    },
  },
  required: ['kind'],
}

export const TOOL_SCHEMAS = {
  searchDocs: {
    name: 'searchDocs',
    description: 'Search documentation for Unity, Unreal, or Frostbite game engines. Use this when the user asks about APIs, features, or how to do something in a specific engine.',
    parameters: SearchDocsInputSchema,
  },
  proposeCode: {
    name: 'proposeCode',
    description: 'Generate code snippets, diffs, or integration checklists for NPC agents in game engines. Use this when the user asks for code, scripts, or integration steps.',
    parameters: CodeActionInputSchema,
  },
  outputSnippets: {
    name: 'outputSnippets',
    description: 'Output ready-to-use code snippets without diffs. Use this when the user wants copy-paste code examples.',
    parameters: CodeActionInputSchema,
  },
  sendGameAction: {
    name: 'sendGameAction',
    description: 'Send an action to the running game (NPC say, walk, emote). Use this when the user wants the NPC to do something NOW in the game.',
    parameters: GameActionInputSchema,
  },
  getDevtools: {
    name: 'getDevtools',
    description: 'Fetch console logs, errors, or network issues. Use this when the user mentions errors, console issues, or debugging problems.',
    parameters: DevtoolsQueryInputSchema,
  },
  createScene: {
    name: 'createScene',
    description: 'Create a new 2D game scene with a specified name, theme, and size.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Scene name' },
        theme: { type: 'string', description: 'Scene theme (e.g., "town", "forest", "dungeon")' },
        width: { type: 'number', description: 'Scene width in pixels' },
        height: { type: 'number', description: 'Scene height in pixels' },
      },
      required: ['name'],
    },
  },
  addNPC: {
    name: 'addNPC',
    description: 'Add a non-player character (NPC) to a specific scene.',
    parameters: {
      type: 'object',
      properties: {
        scene: { type: 'string', description: 'Scene name' },
        name: { type: 'string', description: 'NPC name' },
        sprite: { type: 'string', description: 'Sprite identifier' },
        x: { type: 'number', description: 'X position' },
        y: { type: 'number', description: 'Y position' },
        entryDialogueNode: { type: 'string', description: 'Entry dialogue node ID' },
      },
      required: ['scene', 'name', 'x', 'y'],
    },
  },
  addDialogue: {
    name: 'addDialogue',
    description: 'Add a dialogue node to the dialogue graph.',
    parameters: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Node ID' },
        type: { type: 'string', enum: ['line', 'choice', 'jump', 'setVar'], description: 'Node type' },
        content: { type: 'string', description: 'Dialogue content' },
        choices: { type: 'array', items: { type: 'object' }, description: 'Choice options' },
        targetId: { type: 'string', description: 'Target node ID' },
        variable: { type: 'string', description: 'Variable name' },
        value: { type: 'any', description: 'Variable value' },
      },
      required: ['nodeId', 'type'],
    },
  },
  connectNodes: {
    name: 'connectNodes',
    description: 'Connect two dialogue nodes.',
    parameters: {
      type: 'object',
      properties: {
        fromId: { type: 'string', description: 'Source node ID' },
        toId: { type: 'string', description: 'Target node ID' },
        condition: { type: 'object', description: 'Optional condition' },
      },
      required: ['fromId', 'toId'],
    },
  },
  buildGame: {
    name: 'buildGame',
    description: 'Generate complete Phaser 3 game code that runs in the preview. ALWAYS use this tool when the user asks to "build", "create", "make", "generate", or "design" a GAME. This is the PRIMARY tool for creating playable games in the Design Board and Preview. Examples: "build a tic-tac-toe game", "create a simple adventure game", "make me a puzzle game".',
    parameters: {
      type: 'object',
      properties: {
        gameType: { type: 'string', description: 'Type of game (e.g., "tic-tac-toe", "adventure", "puzzle")' },
        description: { type: 'string', description: 'Game description from the user' },
        features: { type: 'array', items: { type: 'string' }, description: 'List of game features' },
        assets: { 
          type: 'array', 
          items: { type: 'object' },
          description: 'Optional list of generated game assets (from generateGameAssets tool)' 
        },
      },
      required: ['gameType', 'description'],
    },
  },
  generateGameAssets: {
    name: 'generateGameAssets',
    description: 'Generate game assets (images, sprites, logos) using AI image generation. Use this BEFORE buildGame when creating a new game to generate visual assets like tiles, markers (X/O), logos, backgrounds, sprites, and icons. This tool creates PNG/JPG files and stores them for use in the game.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: 'Game ID to associate assets with' },
        gameType: { type: 'string', description: 'Type of game (e.g., "tic-tac-toe", "adventure", "puzzle")' },
        description: { type: 'string', description: 'Game description from the user' },
        assets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { 
                type: 'string', 
                enum: ['tile', 'marker', 'logo', 'background', 'sprite', 'icon'],
                description: 'Type of asset to generate' 
              },
              name: { type: 'string', description: 'Asset name/identifier (e.g., "x_marker", "o_marker", "game_logo")' },
              description: { type: 'string', description: 'Detailed description of what the asset should look like' },
              size: {
                type: 'object',
                properties: {
                  width: { type: 'number', description: 'Asset width in pixels' },
                  height: { type: 'number', description: 'Asset height in pixels' },
                },
              },
            },
            required: ['type', 'name', 'description'],
          },
          description: 'List of assets to generate',
        },
      },
      required: ['gameId', 'gameType', 'description', 'assets'],
    },
  },
} as const

export const CreateSceneInputSchema = TOOL_SCHEMAS.createScene.parameters
export const AddNpcInputSchema = TOOL_SCHEMAS.addNPC.parameters
export const AddDialogueInputSchema = TOOL_SCHEMAS.addDialogue.parameters
export const ConnectNodesInputSchema = TOOL_SCHEMAS.connectNodes.parameters
export const BuildGameInputSchema = TOOL_SCHEMAS.buildGame.parameters
