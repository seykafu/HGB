// Dialogue node types
export type DialogueNodeType = 'line' | 'choice' | 'jump' | 'setVar' | 'condition'

export interface DialogueNode {
  id: string
  type: DialogueNodeType
  content?: string // For 'line' nodes
  choices?: DialogueChoice[] // For 'choice' nodes
  targetId?: string // For 'jump' nodes
  variable?: string // For 'setVar' and 'condition' nodes
  value?: any // For 'setVar' nodes
  condition?: {
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte'
    value: any
  } // For 'condition' nodes
}

export interface DialogueChoice {
  text: string
  targetId: string
  condition?: {
    variable: string
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte'
    value: any
  }
}

export interface DialogueGraph {
  nodes: DialogueNode[]
  startNodeId: string
}

export interface GameVariables {
  [key: string]: string | number | boolean
}

export interface DialogueState {
  currentNodeId: string | null
  variables: GameVariables
  history: string[] // Track visited nodes for debugging
}

