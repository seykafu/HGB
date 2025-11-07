import { callWithTools } from '../lib/openai-tools'
import { streamFromBackend } from '../lib/openai'
import { get } from '../lib/storage'
import { TOOL_SCHEMAS } from '../tools/schema'
import { searchDocs } from '../tools/searchDocs'
import { proposeCode, outputSnippets } from '../tools/codeActions'
import { sendGameAction } from '../tools/gameBridge'
import { getDevtools } from '../tools/devtoolsBridge'
import { manipulatePage } from '../tools/pageManipulation'
import type { ChatMessage } from '../lib/openai'

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orchestrator for an indie game NPC Copilot. Your job is to route user requests to the right tools.

IMPORTANT: You MUST use the searchDocs tool when the user asks about:
- Documentation, APIs, or "how do I" questions
- Unity, Unreal, or Frostbite features
- Game engine concepts, components, or systems
- Any question that could be answered from documentation

Use other tools for:
- Code generation: proposeCode or outputSnippets
- Immediate game actions: sendGameAction
- Debugging errors: getDevtools
- Page interaction: manipulatePage (when user wants to click, type, scroll, highlight, or modify elements on the current web page)

You may call multiple tools in sequence. Always provide a friendly, helpful final answer with citations when using docs.`

const FALLBACK_SYSTEM_PROMPT = `You are a helpful assistant for indie game developers. Help users with:
- Unity/Unreal/Frostbite documentation questions
- Code generation for NPC agents
- Debugging game issues
- Game actions and NPC behavior
- Interacting with web pages (clicking, typing, scrolling, highlighting)

Provide clear, practical answers with code examples when relevant. Be engaging and proactive in helping users.`

// Status message mapping
const TOOL_STATUS_MESSAGES: Record<string, string> = {
  searchDocs: 'Analyzing documents...',
  proposeCode: 'Generating code...',
  outputSnippets: 'Generating code...',
  sendGameAction: 'Sending game action...',
  getDevtools: 'Debugging...',
  manipulatePage: 'Interacting with page...',
}

export interface OrchestrateResult {
  stream: ReadableStream<Uint8Array>
  citations?: string[]
}

export type StatusCallback = (status: string | null) => void

export async function orchestrate(
  userText: string,
  conversationHistory: ChatMessage[] = [],
  onStatusUpdate?: StatusCallback
): Promise<OrchestrateResult> {
  // Check if we have OpenAI API key for tool calling
  const key = await get<string>('openaiKey', '')
  const backendMode = await get<string>('backendMode', 'proxy')
  
  // If no API key or in proxy mode, use regular streaming (fallback)
  // But we can still try to use searchDocs directly for documentation questions
  const isDocQuestion = /(how|what|where|when|why|documentation|api|unity|unreal|frostbite|guide|tutorial|help|learn)/i.test(userText)
  
  if (!key || backendMode === 'proxy') {
    console.log('GameNPC: Using fallback mode (no tool calling)')
    
    // If it's a documentation question, try to use searchDocs directly
    if (isDocQuestion) {
      try {
        console.log('GameNPC: Detected doc question, using searchDocs directly')
        onStatusUpdate?.('Analyzing documents...')
        
        // Infer engine from query
        let engine: 'unity' | 'unreal' | 'frostbite' | 'auto' = 'auto'
        if (/unity/i.test(userText)) engine = 'unity'
        else if (/unreal/i.test(userText)) engine = 'unreal'
        else if (/frostbite/i.test(userText)) engine = 'frostbite'
        
        const searchResult = await searchDocs({ query: userText, engine })
        
        if (searchResult.ok && searchResult.citations && searchResult.citations.length > 0) {
          // Use the search result as the answer
          const answer = searchResult.data?.answer || searchResult.message || 'No documentation found.'
          const citations = searchResult.citations
          
          onStatusUpdate?.('Processing response...')
          
          // Create a stream from the answer
          const stream = new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder()
              for (let i = 0; i < answer.length; i++) {
                controller.enqueue(encoder.encode(answer[i]))
              }
              controller.close()
            },
          })
          
          onStatusUpdate?.(null)
          return { stream, citations }
        }
      } catch (error) {
        console.warn('GameNPC: Direct searchDocs failed, falling back to regular mode:', error)
      }
    }
    
    // Regular fallback
    onStatusUpdate?.('Processing...')
    const messages: ChatMessage[] = [
      { role: 'system', content: FALLBACK_SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: userText },
    ]
    
    const stream = await streamFromBackend(messages)
    if (!stream) {
      throw new Error('Failed to get response from backend')
    }
    onStatusUpdate?.(null)
    return { stream }
  }

  // Tool calling mode (requires OpenAI API key)
  const tools = [
    TOOL_SCHEMAS.searchDocs,
    TOOL_SCHEMAS.proposeCode,
    TOOL_SCHEMAS.outputSnippets,
    TOOL_SCHEMAS.sendGameAction,
    TOOL_SCHEMAS.getDevtools,
    TOOL_SCHEMAS.manipulatePage,
  ]

  const toolHandlers: Record<string, (args: any) => Promise<any>> = {
    searchDocs: async (args) => {
      const result = await searchDocs(args)
      return result
    },
    proposeCode: async (args) => {
      const result = await proposeCode(args)
      return result
    },
    outputSnippets: async (args) => {
      const result = await outputSnippets(args)
      return result
    },
    sendGameAction: async (args) => {
      const result = await sendGameAction(args)
      return result
    },
    getDevtools: async (args) => {
      const result = await getDevtools(args)
      return result
    },
    manipulatePage: async (args) => {
      const result = await manipulatePage(args)
      return result
    },
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: ORCHESTRATOR_SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: userText },
  ]

  try {
    onStatusUpdate?.('Thinking...')
    const collectedCitations: string[] = []
    
    // We need to intercept tool calls to collect citations
    // For now, we'll use a wrapper that tracks citations
    const stream = await callWithToolsWithCitations(
      messages, 
      tools, 
      toolHandlers,
      collectedCitations,
      0,
      onStatusUpdate
    )
    
    if (!stream) {
      throw new Error('Failed to get response from orchestrator')
    }

    onStatusUpdate?.(null)
    return { 
      stream,
      citations: collectedCitations.length > 0 ? collectedCitations : undefined
    }
  } catch (error) {
    // If tool calling fails, fallback to regular streaming
    console.warn('GameNPC: Tool calling failed, falling back to regular mode:', error)
    onStatusUpdate?.('Processing...')
    const fallbackMessages: ChatMessage[] = [
      { role: 'system', content: FALLBACK_SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: userText },
    ]
    
    const stream = await streamFromBackend(fallbackMessages)
    if (!stream) {
      throw new Error('Failed to get response from backend')
    }
    onStatusUpdate?.(null)
    return { stream }
  }
}

// Wrapper to collect citations from tool calls
async function callWithToolsWithCitations(
  messages: ChatMessage[],
  tools: Array<{ name: string; description: string; parameters: any }>,
  toolHandlers: Record<string, (args: any) => Promise<any>>,
  citations: string[],
  depth: number = 0,
  onStatusUpdate?: StatusCallback
): Promise<ReadableStream<Uint8Array> | null> {
  const MAX_DEPTH = 5
  if (depth > MAX_DEPTH) {
    throw new Error('Maximum tool call depth reached')
  }

  try {
    const key = await get<string>('openaiKey', '')
    if (!key || key.trim() === '') {
      throw new Error('OpenAI API key required')
    }

    const model = await get<string>('model', 'gpt-4o-mini')
    
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
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
          const toolName = toolCall.function.name
          const statusMessage = TOOL_STATUS_MESSAGES[toolName] || 'Processing...'
          onStatusUpdate?.(statusMessage)
          
          const handler = toolHandlers[toolName]
          if (!handler) {
            return {
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify({ ok: false, message: `Unknown tool: ${toolName}` }),
            }
          }

          try {
            const args = JSON.parse(toolCall.function.arguments)
            const result = await handler(args)
            
            // Collect citations from searchDocs results
            if (toolName === 'searchDocs' && result.citations && Array.isArray(result.citations)) {
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
      onStatusUpdate?.('Synthesizing response...')
      return callWithToolsWithCitations(newMessages, tools, toolHandlers, citations, depth + 1, onStatusUpdate)
    }

    // No tool calls, return final response as stream
    onStatusUpdate?.('Generating response...')
    const finalText = message.content || ''
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

export interface ToolCallEvent {
  tool: string
  args: any
  result?: any
}

export async function orchestrateWithEvents(
  userText: string,
  conversationHistory: ChatMessage[] = [],
  onToolCall?: (event: ToolCallEvent) => void
): Promise<OrchestrateResult> {
  // For now, use the simple orchestrate
  // In a full implementation, we'd intercept tool calls and emit events
  return orchestrate(userText, conversationHistory)
}
