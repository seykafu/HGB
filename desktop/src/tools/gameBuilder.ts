import type { ToolResult } from './schema'
import type { GameScene } from '../game/engine/phaserRuntime'
import type { DialogueNode, DialogueGraph } from '../game/narrative/types'

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

