import React from 'react'

export function Tabs({
  value,
  onChange,
  items,
}: {
  value: string
  onChange: (v: string) => void
  items: { id: string; label: string; icon?: React.ReactNode }[]
}) {
  return (
    <div
      className="flex gap-2 border-b border-[#533F31]/20 px-2 bg-[#F8F1E3]"
      role="tablist"
      aria-label="Navigation tabs"
    >
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={[
            'px-3 py-2 rounded-t-lg font-display text-lg transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#533F31]/40',
            value === it.id
              ? 'bg-[#F0E4CC] text-[#2E2A25] border-x border-t border-[#533F31]/20'
              : 'text-[#2E2A25]/70 hover:text-[#2E2A25]',
          ].join(' ')}
          aria-selected={value === it.id}
          role="tab"
          aria-controls={`tabpanel-${it.id}`}
          id={`tab-${it.id}`}
        >
          <span className="inline-flex items-center gap-2">
            {it.icon}
            {it.label}
          </span>
        </button>
      ))}
    </div>
  )
}
