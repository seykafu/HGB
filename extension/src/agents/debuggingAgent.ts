import { getDevtools } from '../tools/devtoolsBridge'
import type { DevtoolsQueryInput, ToolResult } from '../tools/schema'

export interface DebugResult {
  diagnosis: string
  probableCause: string
  fixes: string[]
  quickChecks: string[]
}

export async function diagnoseIssue(input: DevtoolsQueryInput): Promise<DebugResult> {
  const result = await getDevtools(input)
  
  if (!result.ok) {
    return {
      diagnosis: 'Unable to access devtools',
      probableCause: 'DevTools not available',
      fixes: ['Open browser DevTools and check console manually'],
      quickChecks: [],
    }
  }

  const data = result.data as { entries: any[] }
  const entries = data.entries || []

  // Analyze errors
  const errors = entries.filter((e) => e.level === 'error')
  const warnings = entries.filter((e) => e.level === 'warn')

  let diagnosis = 'No critical errors found'
  let probableCause = 'Unknown'
  const fixes: string[] = []
  const quickChecks: string[] = []

  if (errors.length > 0) {
    const errorText = errors[0]?.text || ''
    
    if (errorText.includes('WebSocket') || errorText.includes('101')) {
      diagnosis = 'WebSocket connection error'
      probableCause = 'WebSocket handshake failed or server not running'
      fixes.push('1. Ensure your game server is running on the expected port')
      fixes.push('2. Check WebSocket URL in Options (should be ws://localhost:PORT/npc)')
      fixes.push('3. Verify CORS settings allow WebSocket connections')
      quickChecks.push('Check if ws://localhost:PORT is accessible')
    } else if (errorText.includes('CORS')) {
      diagnosis = 'CORS (Cross-Origin) error'
      probableCause = 'Server blocking cross-origin requests'
      fixes.push('1. Configure server to allow CORS from chrome-extension://')
      fixes.push('2. Add Access-Control-Allow-Origin header')
      quickChecks.push('Check Network tab for failed requests')
    } else if (errorText.includes('JSON') || errorText.includes('parse')) {
      diagnosis = 'JSON parsing error'
      probableCause = 'Invalid JSON response from API'
      fixes.push('1. Check API response format')
      fixes.push('2. Verify OpenAI API key is valid')
      fixes.push('3. Check proxy URL is correct')
    } else if (errorText.includes('null') || errorText.includes('undefined')) {
      diagnosis = 'Null reference error'
      probableCause = 'Missing or undefined variable/object'
      fixes.push('1. Check for null/undefined checks in code')
      fixes.push('2. Verify all required objects are initialized')
    } else {
      diagnosis = `Error detected: ${errorText.substring(0, 100)}`
      probableCause = 'See error details'
      fixes.push('1. Review full error message in console')
      fixes.push('2. Check stack trace for source')
    }
  } else if (warnings.length > 0) {
    diagnosis = 'Warnings detected (non-critical)'
    probableCause = warnings[0]?.text?.substring(0, 50) || 'Unknown'
  }

  return {
    diagnosis,
    probableCause,
    fixes,
    quickChecks,
  }
}

