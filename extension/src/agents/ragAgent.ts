import { searchDocs } from '../tools/searchDocs'
import type { SearchDocsInput, ToolResult } from '../tools/schema'

export interface RAGResult {
  citations: string[]
  answer: string
  followups?: string[]
}

export async function queryRAG(input: SearchDocsInput): Promise<RAGResult> {
  const result = await searchDocs(input)
  
  if (!result.ok) {
    return {
      citations: [],
      answer: result.message || 'Failed to search documentation',
    }
  }

  const data = result.data as { answer: string; chunks: any[] }
  
  return {
    citations: result.citations || [],
    answer: data.answer || result.message || 'No answer found',
    followups: [
      'Would you like more details on a specific topic?',
      'Need code examples?',
    ],
  }
}

