export type NpcAction =
  | { type: 'say'; text: string }
  | { type: 'walk'; to: { x: number; y: number } }
  | { type: 'emote'; name: 'wave' | 'shrug' | 'dance' | 'laugh' | 'think' }

export interface NpcProfile {
  id: string
  name: string
  emoji?: string
  systemPrompt: string
  traits: string[]
  goals: string[]
  memory?: string
}

export interface ActionLog {
  id: string
  timestamp: number
  npcId: string
  action: NpcAction
}

