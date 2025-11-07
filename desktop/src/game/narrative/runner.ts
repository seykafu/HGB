import type { DialogueGraph, DialogueNode, DialogueState, GameVariables } from './types'

export class DialogueRunner {
  private graph: DialogueGraph
  private state: DialogueState

  constructor(graph: DialogueGraph, initialVariables: GameVariables = {}) {
    this.graph = graph
    this.state = {
      currentNodeId: graph.startNodeId,
      variables: { ...initialVariables },
      history: [],
    }
  }

  getCurrentNode(): DialogueNode | null {
    if (!this.state.currentNodeId) return null
    return this.graph.nodes.find(n => n.id === this.state.currentNodeId) || null
  }

  getVariables(): GameVariables {
    return { ...this.state.variables }
  }

  setVariable(key: string, value: any): void {
    this.state.variables[key] = value
  }

  getVariable(key: string): any {
    return this.state.variables[key]
  }

  async *run(): AsyncGenerator<DialogueNode | DialogueNode[], void, number | null> {
    while (this.state.currentNodeId) {
      const node = this.getCurrentNode()
      if (!node) break

      this.state.history.push(node.id)

      // Handle node types
      switch (node.type) {
        case 'line':
          yield node
          // Auto-advance to next node if there's a target
          if (node.targetId) {
            this.state.currentNodeId = node.targetId
          } else {
            this.state.currentNodeId = null
          }
          break

        case 'choice':
          yield node
          // Wait for user choice
          const choiceIndex = yield node
          if (typeof choiceIndex === 'number' && node.choices) {
            const choice = node.choices[choiceIndex]
            if (choice && this.evaluateCondition(choice.condition)) {
              this.state.currentNodeId = choice.targetId
            }
          }
          break

        case 'jump':
          if (node.targetId) {
            this.state.currentNodeId = node.targetId
          } else {
            this.state.currentNodeId = null
          }
          break

        case 'setVar':
          if (node.variable && node.value !== undefined) {
            this.setVariable(node.variable, node.value)
          }
          if (node.targetId) {
            this.state.currentNodeId = node.targetId
          } else {
            this.state.currentNodeId = null
          }
          break

        case 'condition':
          if (node.variable && node.condition) {
            const passes = this.evaluateCondition({
              variable: node.variable,
              operator: node.condition.operator,
              value: node.condition.value,
            })
            if (passes && node.targetId) {
              this.state.currentNodeId = node.targetId
            } else {
              this.state.currentNodeId = null
            }
          }
          break

        default:
          this.state.currentNodeId = null
      }
    }
  }

  private evaluateCondition(condition?: {
    variable: string
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte'
    value: any
  }): boolean {
    if (!condition) return true

    const varValue = this.getVariable(condition.variable)
    const { operator, value } = condition

    switch (operator) {
      case 'eq':
        return varValue === value
      case 'ne':
        return varValue !== value
      case 'gt':
        return varValue > value
      case 'lt':
        return varValue < value
      case 'gte':
        return varValue >= value
      case 'lte':
        return varValue <= value
      default:
        return true
    }
  }

  getState(): DialogueState {
    return {
      currentNodeId: this.state.currentNodeId,
      variables: { ...this.state.variables },
      history: [...this.state.history],
    }
  }
}

