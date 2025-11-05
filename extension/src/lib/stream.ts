export async function* readStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      yield decoder.decode(value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
}

export function parseActionMarkers(text: string): Array<{ action: string; text: string }> {
  const actionRegex = /<<<ACTION\s+type="([^"]+)"(?:\s+([^>]+))?>>>/g
  const matches: Array<{ action: string; text: string }> = []
  let match

  while ((match = actionRegex.exec(text)) !== null) {
    const [, type, attrs] = match
    matches.push({ action: type, text: attrs || '' })
  }

  return matches
}

