import { callWithToolsWithCitations } from '../lib/openai-tools'
import { streamFromBackend } from '../lib/openai'
import { get } from '../lib/storage'
import { TOOL_SCHEMAS } from '../tools/schema'
import { searchDocs } from '../tools/searchDocs'
import { proposeCode, outputSnippets } from '../tools/codeActions'
import { sendGameAction } from '../tools/gameBridge'
import { getDevtools } from '../tools/devtoolsBridge'
// Note: manipulatePage is not available in desktop app
import type { ChatMessage } from '../lib/openai'

export type StatusCallback = (status: string) => void

export interface OrchestrateResult {
  stream: ReadableStream<Uint8Array>
  citations?: string[]
}

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orchestrator for an indie game NPC Copilot. Your job is to route user requests to the right tools:

1. **searchDocs**: Use when user asks about APIs, documentation, or "how do I..." questions for Unity/Unreal/Frostbite
2. **proposeCode** or **outputSnippets**: Use when user wants code, scripts, or integration steps
3. **sendGameAction**: Use when user wants the NPC to do something NOW in the running game (e.g., "walk to waypoint", "say", "emote")
4. **getDevtools**: Use when user mentions errors, console issues, debugging, or "not working"

Note: Page manipulation is not available in the desktop app version.

You may call multiple tools in sequence. Always provide a friendly, helpful final answer with citations when using docs.`

const FALLBACK_SYSTEM_PROMPT = `You are a helpful assistant for indie game developers. Help users with:
- Unity/Unreal/Frostbite documentation questions
- Code generation for NPC agents
- Debugging game issues
- Game actions and NPC behavior

Provide clear, practical answers with code examples when relevant.`

const TOOL_STATUS_MESSAGES: Record<string, string> = {
  searchDocs: 'Analyzing documents...',
  proposeCode: 'Generating code...',
  outputSnippets: 'Generating code...',
  sendGameAction: 'Sending game action...',
  getDevtools: 'Debugging...',
}

export async function orchestrate(
  userText: string,
  conversationHistory: ChatMessage[] = [],
  onStatusUpdate?: StatusCallback
): Promise<OrchestrateResult> {
  onStatusUpdate?.('Thinking...')

  // Check if we have OpenAI API key for tool calling
  // Try storage first, then fall back to environment variable
  let key = await get<string>('openaiKey', '')
  if (!key && typeof window !== 'undefined' && window.electronAPI?.env) {
    const envKey = await window.electronAPI.env.get('OPENAI_API_KEY')
    if (envKey) {
      key = envKey
      console.log('GameNPC Desktop: Using OPENAI_API_KEY from environment variable in orchestrator')
    }
  }
  const backendMode = await get<string>('backendMode', 'direct')
  
  // If no API key or in proxy mode, use regular streaming (fallback)
  // But we can still try to use searchDocs directly for documentation questions
  const isDocQuestion = /(how|what|where|when|why|documentation|api|unity|unreal|frostbite|guide|tutorial|help|learn)/i.test(userText)
  
  if (!key || backendMode === 'proxy') {
    console.log('GameNPC: Using fallback mode (no tool calling)')
    
    // If it's a documentation question, try to use searchDocs directly
    if (isDocQuestion) {
      try {
        onStatusUpdate?.('Analyzing documents...')
        console.log('GameNPC: Detected doc question, using searchDocs directly')
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
          
          // Create a stream from the answer content
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              let index = 0
              const sendChunk = () => {
                if (index < answer.length) {
                  controller.enqueue(encoder.encode(answer[index]))
                  index++
                  setTimeout(sendChunk, 10)
                } else {
                  controller.close()
                }
              }
              sendChunk()
            },
          })
          
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
    return { stream }
  }

  // Tool calling mode (requires OpenAI API key)
  // Note: manipulatePage is excluded for desktop app
  const tools = [
    TOOL_SCHEMAS.searchDocs,
    TOOL_SCHEMAS.proposeCode,
    TOOL_SCHEMAS.outputSnippets,
    TOOL_SCHEMAS.sendGameAction,
    TOOL_SCHEMAS.getDevtools,
  ]

  const toolHandlers: Record<string, (args: any) => Promise<any>> = {
    searchDocs: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.searchDocs)
      const result = await searchDocs(args)
      return result
    },
    proposeCode: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.proposeCode)
      const result = await proposeCode(args)
      return result
    },
    outputSnippets: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.outputSnippets)
      const result = await outputSnippets(args)
      return result
    },
    sendGameAction: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.sendGameAction)
      const result = await sendGameAction(args)
      return result
    },
    getDevtools: async (args) => {
      onStatusUpdate?.(TOOL_STATUS_MESSAGES.getDevtools)
      const result = await getDevtools(args)
      return result
    },
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: ORCHESTRATOR_SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: userText },
  ]

  try {
    const collectedCitations: string[] = []
    
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
    return { stream }
  }
}
