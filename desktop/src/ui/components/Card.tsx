import React from 'react'

function CornerMarks() {
  const cls = 'absolute w-3 h-3 border-[2px] border-[#533F31]'
  return (
    <>
      {/* Top-left corner accent */}
      <div className={`${cls} top-2 left-2 rounded-tr-none rounded-bl-none rounded-tl-[2px] rounded-br-[2px]`} />
      {/* Bottom-right corner accent */}
      <div className={`${cls} bottom-2 right-2 rounded-tl-none rounded-br-none rounded-tr-[2px] rounded-bl-[2px]`} />
    </>
  )
}

export function Card({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={[
        'relative bg-[#FBF7EF] text-[#2E2A25]',
        'shadow-[0_2px_0_rgba(46,42,37,0.2),0_10px_20px_rgba(46,42,37,0.08)]',
        'ring-1 ring-[#533F31]',
        'before:absolute before:inset-0',
        'before:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_0_rgba(0,0,0,0.05)]',
        'before:pointer-events-none',
        'p-4 sm:p-6',
        className,
      ].join(' ')}
    >
      <div className="pointer-events-none absolute -inset-[1px]">
        <CornerMarks />
      </div>
      {children}
    </div>
  )
}
