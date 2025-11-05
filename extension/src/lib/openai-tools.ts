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

export async function callWithTools(
  messages: ChatMessage[],
  tools: Array<{ name: string; description: string; parameters: any }>,
  toolHandlers: Record<string, (args: any) => Promise<any>>,
  depth: number = 0
): Promise<ReadableStream<Uint8Array> | null> {
  if (depth > MAX_TOOL_CALL_DEPTH) {
    throw new Error('Maximum tool call depth reached')
  }

  try {
    const key = await get<string>('openaiKey', '')
    
    if (!key || key.trim() === '') {
      throw new Error('OpenAI API key required for tool calling. Please set it in Options > Direct OpenAI mode.')
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
        stream: false, // For tool calling, we need non-streaming first
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
      let errorMessage = `OpenAI error: ${res.status}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorMessage
      } catch {
        errorMessage += ` ${errorText.substring(0, 100)}`
      }
      throw new Error(errorMessage)
    }

    const data = await res.json()
    const message = data.choices[0]?.message

    if (message.tool_calls && message.tool_calls.length > 0) {
      // Execute tool calls
      const toolResults = await Promise.all(
        message.tool_calls.map(async (toolCall: ToolCall) => {
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
            const result = await handler(args)
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

      // Add tool messages and continue conversation
      const newMessages: ChatMessage[] = [
        ...messages,
        message,
        ...toolResults,
      ]

      // Recursively call with updated messages
      return callWithTools(newMessages, tools, toolHandlers, depth + 1)
    }

    // No tool calls, return final response as stream
    const finalText = message.content || ''
    return new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        // Simulate streaming by sending in chunks
        let index = 0
        const sendChunk = () => {
          if (index < finalText.length) {
            controller.enqueue(encoder.encode(finalText[index]))
            index++
            setTimeout(sendChunk, 10) // Small delay for streaming effect
          } else {
            controller.close()
          }
        }
        sendChunk()
      },
    })
  } catch (error) {
    console.error('Paralogue: Tool calling error:', error)
    throw error
  }
}
