import { proposeCode, outputSnippets } from '../tools/codeActions'
import type { CodeActionInput, ToolResult } from '../tools/schema'

export interface CodeResult {
  diff?: string
  snippets?: string
  checklist: string[]
}

export async function generateCode(input: CodeActionInput): Promise<CodeResult> {
  const result = await proposeCode(input)
  
  if (!result.ok) {
    return {
      checklist: [],
    }
  }

  const data = result.data as { code: string; checklist: string[] }
  
  return {
    snippets: data.code,
    checklist: data.checklist || [],
  }
}

export async function generateSnippets(input: CodeActionInput): Promise<string> {
  const result = await outputSnippets(input)
  
  if (!result.ok) {
    return 'Failed to generate snippets'
  }

  const data = result.data as { code: string }
  return data.code || ''
}

