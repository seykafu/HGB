import type { SearchDocsInput, ToolResult } from './schema'
import { searchChunks } from './docsIndex'

export async function searchDocs(input: SearchDocsInput): Promise<ToolResult> {
  try {
    const engine = input.engine === 'auto' ? 'unity' : input.engine // Default to unity for now
    const chunks = await searchChunks(engine, input.query, 5)

    if (chunks.length === 0) {
      return {
        ok: true,
        data: { chunks: [], answer: 'No relevant documentation found.' },
        message: 'No results found',
        citations: [],
      }
    }

    // Synthesize answer from chunks
    const answer = chunks
      .map((chunk) => `**${chunk.heading || chunk.path}**: ${chunk.text}`)
      .join('\n\n')

    const citations = chunks.map((chunk) => chunk.path)

    return {
      ok: true,
      data: {
        chunks,
        answer,
        engine,
      },
      message: `Found ${chunks.length} relevant sections`,
      citations,
    }
  } catch (error) {
    return {
      ok: false,
      message: `Failed to search docs: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

