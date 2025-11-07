import { get } from './storage'
import type { ChatMessage } from './openai'

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

const MAX_TOOL_CALL_DEPTH = 5

export async function callWithToolsWithCitations(
  messages: ChatMessage[],
  tools: Array<{ name: string; description: string; parameters: any }>,
  toolHandlers: Record<string, (args: any) => Promise<any>>,
  citations: string[], // Pass citations array by reference
  depth: number = 0,
  onStatusUpdate?: (status: string) => void
): Promise<ReadableStream<Uint8Array> | null> {
  if (depth > MAX_TOOL_CALL_DEPTH) {
    throw new Error('Maximum tool call depth reached')
  }

  try {
    // Try to get key from storage first, then fall back to environment variable
    let key = await get<string>('openaiKey', '')
    if (!key && typeof window !== 'undefined' && window.electronAPI?.env) {
      const envKey = await window.electronAPI.env.get('OPENAI_API_KEY')
      if (envKey) {
        key = envKey
        console.log('GameNPC Desktop: Using OPENAI_API_KEY from environment variable for tool calling')
      }
    }
    
    if (!key || key.trim() === '') {
      throw new Error('OpenAI API key required for tool calling. Please set it in Settings > Direct OpenAI mode, or set the OPENAI_API_KEY environment variable.')
    }

    const model = await get<string>('model', 'gpt-4o-mini')
    
    // Use OpenAI API directly for tool calling
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        stream: false, // Not streaming initial tool call response
        messages,
        tools: tools.map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        tool_choice: 'auto',
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`OpenAI error: ${res.status}`)
    }

    const data = await res.json()
    const message = data.choices[0]?.message

    if (message.tool_calls && message.tool_calls.length > 0) {
      // Execute tool calls and collect citations
      const toolResults = await Promise.all(
        message.tool_calls.map(async (toolCall: any) => {
          const handler = toolHandlers[toolCall.function.name]
          if (!handler) {
            return {
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify({ ok: false, message: `Unknown tool: ${toolCall.function.name}` }),
            }
          }

          try {
            const args = JSON.parse(toolCall.function.arguments)
            onStatusUpdate?.(`Calling tool: ${toolCall.function.name}...`)
            const result = await handler(args)
            
            // Collect citations from searchDocs results
            if (toolCall.function.name === 'searchDocs' && result.citations && Array.isArray(result.citations)) {
              citations.push(...result.citations)
            }
            
            return {
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify(result),
            }
          } catch (error) {
            return {
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify({
                ok: false,
                message: error instanceof Error ? error.message : String(error),
              }),
            }
          }
        })
      )

      const newMessages: ChatMessage[] = [
        ...messages,
        message,
        ...toolResults,
      ]

      // Recursively call with updated messages
      return callWithToolsWithCitations(newMessages, tools, toolHandlers, citations, depth + 1, onStatusUpdate)
    }

    // No tool calls, return final response as stream
    const finalText = message.content || ''
    onStatusUpdate?.('Generating response...')
    return new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        let index = 0
        const sendChunk = () => {
          if (index < finalText.length) {
            controller.enqueue(encoder.encode(finalText[index]))
            index++
            setTimeout(sendChunk, 10)
          } else {
            controller.close()
          }
        }
        sendChunk()
      },
    })
  } catch (error) {
    console.error('GameNPC: Tool calling error:', error)
    throw error
  }
}
