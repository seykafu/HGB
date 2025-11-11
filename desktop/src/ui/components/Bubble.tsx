import React from 'react'

export function Bubble({
  from,
  children,
}: {
  from: 'npc' | 'you'
  children: React.ReactNode
}) {
  const isNPC = from === 'npc'

  return (
    <div className={`flex ${isNPC ? 'justify-start' : 'justify-end'} my-1`}>
      <div
        className={[
          'max-w-[85%] rounded-lg px-4 py-2.5',
          'shadow-[0_2px_0_rgba(46,42,37,0.2),0_10px_20px_rgba(46,42,37,0.08)]',
          'ring-1 ring-[#533F31]/10',
          isNPC ? 'bg-[#FBF7EF]' : 'bg-[#E9C46A]/80',
        ].join(' ')}
      >
        <div className="text-sm text-[#2E2A25] leading-relaxed">{children}</div>
      </div>
    </div>
  )
}
