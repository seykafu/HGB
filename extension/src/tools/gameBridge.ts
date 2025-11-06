import type { GameActionInput, ToolResult } from './schema'

export async function sendGameAction(input: GameActionInput): Promise<ToolResult> {
  try {
    const action = {
      type: input.action,
      ...input.args,
    }

    // Send via postMessage to page
    window.postMessage(
      {
        source: 'GAMENPC',
        action,
      },
      '*'
    )

    // Also try WebSocket if available
    try {
      const wsUrl = await chrome.storage.sync.get('wsUrl')
      if (wsUrl.wsUrl) {
        // Note: WebSocket connection should be managed elsewhere
        // This is a placeholder for the tool interface
      }
    } catch (wsError) {
      // WebSocket not available, that's okay
    }

    return {
      ok: true,
      data: { action },
      message: `Action "${input.action}" sent to game`,
    }
  } catch (error) {
    return {
      ok: false,
      message: `Failed to send action: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

