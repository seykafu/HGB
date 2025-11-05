import React from 'react'

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let key = 0
  
  // Find all bold and link patterns
  const patterns: Array<{ start: number; end: number; type: 'bold' | 'link'; content: string; extra?: string }> = []
  
  // Bold
  let boldMatch
  const boldRegex = /\*\*(.+?)\*\*/g
  while ((boldMatch = boldRegex.exec(text)) !== null) {
    patterns.push({
      start: boldMatch.index,
      end: boldMatch.index + boldMatch[0].length,
      type: 'bold',
      content: boldMatch[1],
    })
  }
  
  // Links
  let linkMatch
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  while ((linkMatch = linkRegex.exec(text)) !== null) {
    patterns.push({
      start: linkMatch.index,
      end: linkMatch.index + linkMatch[0].length,
      type: 'link',
      content: linkMatch[1],
      extra: linkMatch[2],
    })
  }
  
  // Sort by position
  patterns.sort((a, b) => a.start - b.start)
  
  // Build parts
  let currentIndex = 0
  patterns.forEach((pattern) => {
    // Add text before pattern
    if (pattern.start > currentIndex) {
      parts.push(<span key={key++}>{text.slice(currentIndex, pattern.start)}</span>)
    }
    
    // Add formatted content
    if (pattern.type === 'bold') {
      parts.push(<strong key={key++} className="font-semibold text-[#2E2A25]">{pattern.content}</strong>)
    } else if (pattern.type === 'link') {
      parts.push(
        <a
          key={key++}
          href={pattern.extra}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#533F31] underline hover:text-[#6B4F3B]"
        >
          {pattern.content}
        </a>
      )
    }
    
    currentIndex = pattern.end
  })
  
  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(currentIndex)}</span>)
  }
  
  return parts.length > 0 ? parts : [<span key={0}>{text}</span>]
}

function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const processed: React.ReactNode[] = []
  let inList = false
  let listType: 'bullet' | 'numbered' | null = null
  
  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim()
    
    // Headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      // Close any open list
      if (inList) {
        processed.push(<div key={`list-end-${lineIndex}`} className="mb-2" />)
        inList = false
        listType = null
      }
      
      const level = headerMatch[1].length
      const content = headerMatch[2]
      const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements
      processed.push(
        React.createElement(
          HeadingTag,
          {
            key: lineIndex,
            className: [
              level === 1 ? 'text-xl font-bold' : '',
              level === 2 ? 'text-lg font-semibold' : '',
              level === 3 ? 'text-base font-semibold' : '',
              level >= 4 ? 'text-sm font-semibold' : '',
              'mt-3 mb-2 text-[#2E2A25]',
            ].join(' '),
          },
          parseInlineMarkdown(content)
        )
      )
      return
    }
    
    // Bullet list items
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (bulletMatch) {
      if (!inList || listType !== 'bullet') {
        if (inList) {
          processed.push(<div key={`list-end-${lineIndex}`} className="mb-2" />)
        }
        inList = true
        listType = 'bullet'
      }
      processed.push(
        <div key={lineIndex} className="flex items-start gap-2 my-1 ml-2">
          <span className="text-[#533F31] mt-1.5 flex-shrink-0">•</span>
          <span className="flex-1">{parseInlineMarkdown(bulletMatch[1])}</span>
        </div>
      )
      return
    }
    
    // Numbered list items
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (numberedMatch) {
      if (!inList || listType !== 'numbered') {
        if (inList) {
          processed.push(<div key={`list-end-${lineIndex}`} className="mb-2" />)
        }
        inList = true
        listType = 'numbered'
      }
      processed.push(
        <div key={lineIndex} className="flex items-start gap-2 my-1 ml-2">
          <span className="text-[#533F31] font-medium mt-1.5 flex-shrink-0">{numberedMatch[1]}.</span>
          <span className="flex-1">{parseInlineMarkdown(numberedMatch[2])}</span>
        </div>
      )
      return
    }
    
    // Close list if we hit a non-list line
    if (inList && trimmed) {
      processed.push(<div key={`list-end-${lineIndex}`} className="mb-2" />)
      inList = false
      listType = null
    }
    
    // Regular paragraph
    if (trimmed) {
      processed.push(
        <p key={lineIndex} className="my-1.5 leading-relaxed">
          {parseInlineMarkdown(trimmed)}
        </p>
      )
    } else {
      // Empty line - add spacing
      processed.push(<div key={lineIndex} className="h-2" />)
    }
  })
  
  // Close any remaining open list
  if (inList) {
    processed.push(<div key="list-end-final" className="mb-2" />)
  }
  
  return processed
}

export function MessageContent({ content }: { content: string }) {
  const parsed = parseMarkdown(content)
  return <div className="message-content">{parsed}</div>
}
