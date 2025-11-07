// Game bridge for Electron - simplified version
// In desktop app, we can't interact with browser tabs, so this is a placeholder

import type { GameActionInput, ToolResult } from './schema'

export async function sendGameAction(input: GameActionInput): Promise<ToolResult> {
  // In desktop app, game actions would need to be sent via WebSocket or other IPC
  // For now, just log it
  console.log('GameNPC Desktop: Game action requested:', input)
  
  // TODO: Implement WebSocket connection to game engine if needed
  // For now, return success but don't actually send anything
  return {
    ok: true,
    data: { action: input.action, args: input.args },
    message: `Game action logged: ${input.action}`,
  }
}
