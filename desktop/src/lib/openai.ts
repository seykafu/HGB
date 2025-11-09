import { get } from './storage'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  citations?: string[] // Document references from RAG
}

export async function streamFromBackend(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array> | null> {
  try {
    // Desktop app defaults to 'direct' mode since Next.js server may not be running
    const mode = await get<string>('backendMode', 'direct')

    if (mode === 'proxy') {
      const url = await get<string>('proxyUrl', 'http://localhost:3000/api/chat')
      console.log('GameBao Desktop: Calling proxy API:', url, 'with messages:', messages.length)
      
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
          console.error('GameBao: Received HTML instead of JSON. This usually means the API requires authentication.')
          throw new Error('API requires authentication. Please use "Direct OpenAI" mode in Options, or ensure your Next.js API route allows unauthenticated access.')
        }

        if (!res.ok) {
          console.error('GameBao: Proxy error:', res.status, responseText.substring(0, 200))
          throw new Error(`Proxy error: ${res.status} ${res.statusText}`)
        }

        console.log('GameBao: Response content-type:', contentType)
        
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
          console.log('GameBao: Response is plain text, treating as message:', responseText.substring(0, 100))
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
        console.error('GameBao: Proxy fetch error:', fetchError)
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError)
        
        // Check if user has OpenAI key configured for fallback
        // Try storage first, then environment variable
        let key = await get<string>('openaiKey', '')
        if (!key && typeof window !== 'undefined' && window.electronAPI?.env) {
          const envKey = await window.electronAPI.env.get('OPENAI_API_KEY')
          if (envKey) {
            key = envKey
          }
        }
        if (key) {
          console.log('GameBao: Proxy failed, falling back to Direct OpenAI mode')
          // Fall through to Direct OpenAI mode
        } else {
          // For desktop app, provide more helpful error message
          if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
            const proxyUrl = await get<string>('proxyUrl', 'http://localhost:3000/api/chat')
            throw new Error(`Cannot connect to proxy server at ${proxyUrl}.\n\nThis usually means:\n1. The Next.js server is not running, or\n2. The proxy URL is incorrect.\n\nFor the desktop app, we recommend using "Direct OpenAI" mode:\n1. Go to Settings (gear icon)\n2. Select "Direct OpenAI" mode\n3. Enter your OpenAI API key\n4. Click "Save Settings"`)
          }
          throw new Error(`${errorMessage}\n\nTip: Go to Settings and switch to "Direct OpenAI" mode, or ensure your Next.js server is running.`)
        }
      }
    }

    // Direct OpenAI mode (or fallback from proxy)
    // Try to get key from storage first, then fall back to environment variable
    let key = await get<string>('openaiKey', '')
    if (!key && typeof window !== 'undefined' && window.electronAPI?.env) {
      const envKey = await window.electronAPI.env.get('OPENAI_API_KEY')
      if (envKey) {
        key = envKey
        console.log('GameBao Desktop: Using OPENAI_API_KEY from environment variable')
      }
    }
    if (!key) {
      throw new Error('OpenAI API key not configured. Please set it in Settings > Direct OpenAI mode, or set the OPENAI_API_KEY environment variable.')
    }

    let model = await get<string>('model', 'gpt-4o')
    // Auto-migrate from GPT-5 to GPT-4o if GPT-5 is selected (requires org verification)
    if (model === 'gpt-5') {
      console.log('OpenAI: Auto-migrating from GPT-5 to GPT-4o (GPT-5 requires organization verification)')
      model = 'gpt-4o'
    }
    console.log('GameBao: Calling OpenAI API directly with model:', model)
    
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
      console.error('GameBao: OpenAI error:', res.status, errorText)
      let errorMessage = `OpenAI error: ${res.status} ${res.statusText}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorMessage
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage)
    }

    // Parse SSE stream and extract only content
    return new ReadableStream({
      async start(controller) {
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        const encoder = new TextEncoder()
        
        if (!reader) {
          controller.close()
          return
        }

        try {
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              // Skip empty lines and non-data lines
              const trimmed = line.trim()
              if (!trimmed || !trimmed.startsWith('data: ')) {
                continue
              }

              const data = trimmed.slice(6).trim()
              
              // Check for end marker
              if (data === '[DONE]') {
                controller.close()
                return
              }

              // Skip empty data lines
              if (!data) {
                continue
              }

              try {
                const json = JSON.parse(data)
                // Extract only the content delta, ignore everything else
                const content = json.choices?.[0]?.delta?.content || ''
                if (content && typeof content === 'string') {
                  controller.enqueue(encoder.encode(content))
                }
              } catch (e) {
                // Silently skip invalid JSON - don't show raw data
                console.debug('Skipping invalid SSE line:', trimmed.substring(0, 50))
              }
            }
          }
          
          // Process any remaining buffer
          if (buffer.trim()) {
            const trimmed = buffer.trim()
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6).trim()
              if (data && data !== '[DONE]') {
                try {
                  const json = JSON.parse(data)
                  const content = json.choices?.[0]?.delta?.content || ''
                  if (content && typeof content === 'string') {
                    controller.enqueue(encoder.encode(content))
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
          
          controller.close()
        } catch (error) {
          console.error('Stream parsing error:', error)
          controller.error(error)
        } finally {
          reader.releaseLock()
        }
      },
    })
  } catch (error) {
    console.error('GameBao: Stream error:', error)
    // Re-throw with more context
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Unknown error: ${String(error)}`)
  }
}
