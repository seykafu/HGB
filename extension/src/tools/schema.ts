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

export interface ToolResult {
  ok: boolean
  data?: any
  message?: string
  citations?: string[]
}

export const TOOL_SCHEMAS = {
  searchDocs: {
    name: 'searchDocs',
    description: 'Search documentation for Unity, Unreal, or Frostbite game engines. Use this when the user asks about APIs, features, or how to do something in a specific engine.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        engine: {
          type: 'string',
          enum: ['unity', 'unreal', 'frostbite', 'auto'],
          description: 'The game engine to search. Use "auto" if not specified.',
        },
      },
      required: ['query', 'engine'],
    },
  },
  proposeCode: {
    name: 'proposeCode',
    description: 'Generate code snippets, diffs, or integration checklists for NPC agents in game engines. Use this when the user asks for code, scripts, or integration steps.',
    parameters: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'What the code should accomplish',
        },
        framework: {
          type: 'string',
          enum: ['unity', 'unreal', 'frostbite', 'web'],
          description: 'The target framework',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of specific files to modify',
        },
      },
      required: ['goal', 'framework'],
    },
  },
  outputSnippets: {
    name: 'outputSnippets',
    description: 'Output ready-to-use code snippets without diffs. Use this when the user wants copy-paste code examples.',
    parameters: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'What the snippet should do',
        },
        framework: {
          type: 'string',
          enum: ['unity', 'unreal', 'frostbite', 'web'],
        },
      },
      required: ['goal', 'framework'],
    },
  },
  sendGameAction: {
    name: 'sendGameAction',
    description: 'Send an action to the running game (NPC say, walk, emote). Use this when the user wants the NPC to do something NOW in the game.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['say', 'walk', 'emote'],
        },
        args: {
          type: 'object',
          description: 'Action-specific arguments (e.g., {text: "Hello"} for say, {x: 10, y: 20} for walk)',
        },
      },
      required: ['action', 'args'],
    },
  },
  getDevtools: {
    name: 'getDevtools',
    description: 'Fetch console logs, errors, or network issues from the inspected page. Use this when the user mentions errors, console issues, or debugging problems.',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['logs', 'errors', 'network'],
        },
        filter: {
          type: 'string',
          description: 'Optional filter string',
        },
      },
      required: ['kind'],
    },
  },
} as const

