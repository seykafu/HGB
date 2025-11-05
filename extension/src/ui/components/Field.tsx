import React from 'react'
import { Input } from './Input'

export function Field({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-[var(--stroke)]">{label}</span>
      {children}
      {error && <span className="text-xs text-[var(--rose-400)]">{error}</span>}
    </label>
  )
}

export { Input }

