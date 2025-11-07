import React from 'react'

interface CitationsProps {
  citations: string[]
}

export function Citations({ citations }: CitationsProps) {
  if (!citations || citations.length === 0) {
    return null
  }

  // Extract file names from paths
  const fileNames = citations.map((path) => {
    // Extract filename from path like "unity/npc-basics.md" -> "npc-basics.md"
    const parts = path.split('/')
    return parts[parts.length - 1] || path
  })

  // Remove duplicates
  const uniqueFiles = Array.from(new Set(fileNames))

  return (
    <div className="mt-3 pt-3 border-t border-[#533F31]/20">
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-[#533F31] mt-0.5">📚 References:</span>
        <div className="flex-1 flex flex-wrap gap-2">
          {uniqueFiles.map((file, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-1 rounded-md bg-[#F8F1E3] text-xs text-[#533F31] ring-1 ring-[#533F31]/20 hover:bg-[#F0E4CC] transition"
              title={citations.find((c) => c.includes(file)) || file}
            >
              {file}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

