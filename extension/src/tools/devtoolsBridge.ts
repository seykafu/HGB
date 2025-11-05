import type { DevtoolsQueryInput, ToolResult } from './schema'

interface LogEntry {
  time: number
  level: string
  text: string
  source?: string
}

const logBuffer: LogEntry[] = []
const MAX_BUFFER_SIZE = 500

// Initialize message listener if in background context
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type?.startsWith('DEVTOOLS')) {
      let level = 'info'
      if (msg.type.includes('ERROR')) {
        level = 'error'
      } else if (msg.type.includes('REJECTION') || msg.type.includes('WARN')) {
        level = 'warn'
      }

      const entry: LogEntry = {
        time: Date.now(),
        level,
        text: typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload),
        source: msg.source || sender?.tab?.url,
      }

      logBuffer.push(entry)
      if (logBuffer.length > MAX_BUFFER_SIZE) {
        logBuffer.shift()
      }
    }
    return true
  })
}

// Also listen in content script context (for window.postMessage)
if (typeof window !== 'undefined') {
  window.addEventListener('message', (ev) => {
    if (ev.data?.source === 'PARALOGUE_DEVTOOLS') {
      const entry: LogEntry = {
        time: Date.now(),
        level: ev.data.type.includes('ERROR') ? 'error' : 
               ev.data.type.includes('REJECTION') ? 'warn' : 'info',
        text: typeof ev.data.payload === 'string' 
          ? ev.data.payload 
          : JSON.stringify(ev.data.payload),
      }
      
      logBuffer.push(entry)
      if (logBuffer.length > MAX_BUFFER_SIZE) {
        logBuffer.shift()
      }
      
      // Forward to background if available
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: ev.data.type,
          payload: ev.data.payload,
        }).catch(() => {
          // Ignore if background not available
        })
      }
    }
  })
}

export async function getDevtools(input: DevtoolsQueryInput): Promise<ToolResult> {
  try {
    let filtered = logBuffer

    // Filter by kind
    if (input.kind === 'errors') {
      filtered = logBuffer.filter((r) => r.level === 'error' || r.level === 'warn')
    } else if (input.kind === 'logs') {
      filtered = logBuffer
    } else if (input.kind === 'network') {
      filtered = logBuffer.filter((r) => 
        r.text.includes('fetch') || 
        r.text.includes('XMLHttpRequest') || 
        r.text.includes('network') ||
        r.text.includes('CORS') ||
        r.text.includes('WebSocket')
      )
    }

    // Apply text filter
    if (input.filter) {
      filtered = filtered.filter((r) => r.text.toLowerCase().includes(input.filter!.toLowerCase()))
    }

    // Return last 100 entries
    const recent = filtered.slice(-100)

    return {
      ok: true,
      data: {
        entries: recent,
        count: recent.length,
        total: logBuffer.length,
      },
      message: `Found ${recent.length} ${input.kind} entries`,
    }
  } catch (error) {
    return {
      ok: false,
      message: `Failed to get devtools data: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Export buffer for direct access if needed
export function getLogBuffer(): LogEntry[] {
  return [...logBuffer]
}

export function clearLogBuffer(): void {
  logBuffer.length = 0
}
