import { get } from './storage'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  citations?: string[] // Document references from RAG
}

export async function streamFromBackend(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const mode = await get<string>('backendMode', 'proxy')

    if (mode === 'proxy') {
      const url = await get<string>('proxyUrl', 'http://localhost:3000/api/chat')
      console.log('GameNPC: Calling proxy API:', url, 'with messages:', messages.length)
      
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages }), // Send full conversation history
        })

        // Check if response is HTML (redirect to login page, etc.)
        const contentType = res.headers.get('content-type') || ''
        const responseText = await res.text()
        
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html') || contentType.includes('text/html')) {
          console.error('GameNPC: Received HTML instead of JSON. This usually means the API requires authentication.')
          throw new Error('API requires authentication. Please use "Direct OpenAI" mode in Options, or ensure your Next.js API route allows unauthenticated access.')
        }

        if (!res.ok) {
          console.error('GameNPC: Proxy error:', res.status, responseText.substring(0, 200))
          throw new Error(`Proxy error: ${res.status} ${res.statusText}`)
        }

        console.log('GameNPC: Response content-type:', contentType)
        
        // Check if response is streaming
        if (contentType.includes('text/event-stream') || contentType.includes('text/stream')) {
          // Streaming response
          return res.body
        }

        // Check if response is JSON
        if (contentType.includes('application/json')) {
          const data = JSON.parse(responseText)
          const text = data.choices?.[0]?.message?.content || data.response || data.message || ''
          
          // Return a stream-like response
          return new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder()
              for (let i = 0; i < text.length; i++) {
                controller.enqueue(encoder.encode(text[i]))
              }
              controller.close()
            },
          })
        }

        // Try to parse as JSON anyway
        try {
          const data = JSON.parse(responseText)
          const text = data.choices?.[0]?.message?.content || data.response || data.message || responseText
          
          return new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder()
              for (let i = 0; i < text.length; i++) {
                controller.enqueue(encoder.encode(text[i]))
              }
              controller.close()
            },
          })
        } catch (parseError) {
          // If it's not JSON, treat the whole response as text
          console.log('GameNPC: Response is plain text, treating as message:', responseText.substring(0, 100))
          return new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder()
              for (let i = 0; i < responseText.length; i++) {
                controller.enqueue(encoder.encode(responseText[i]))
              }
              controller.close()
            },
          })
        }
      } catch (fetchError) {
        // If proxy fails, suggest using Direct OpenAI mode
        console.error('GameNPC: Proxy fetch error:', fetchError)
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError)
        
        // Check if user has OpenAI key configured for fallback
        const key = await get<string>('openaiKey', '')
        if (key) {
          console.log('GameNPC: Proxy failed, falling back to Direct OpenAI mode')
          // Fall through to Direct OpenAI mode
        } else {
          throw new Error(`${errorMessage}\n\nTip: Go to Options and switch to "Direct OpenAI" mode, or configure your proxy URL correctly.`)
        }
      }
    }

    // Direct OpenAI mode (or fallback from proxy)
    const key = await get<string>('openaiKey', '')
    if (!key) {
      throw new Error('OpenAI API key not configured. Please set it in Options > Direct OpenAI mode.')
    }

    const model = await get<string>('model', 'gpt-4o-mini')
    console.log('GameNPC: Calling OpenAI API directly with model:', model)
    
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('GameNPC: OpenAI error:', res.status, errorText)
      let errorMessage = `OpenAI error: ${res.status} ${res.statusText}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorMessage
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage)
    }

    return res.body
  } catch (error) {
    console.error('GameNPC: Stream error:', error)
    // Re-throw with more context
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Unknown error: ${String(error)}`)
  }
}
