import React from 'react'

export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outlined' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }
  
  const baseClasses = `${sizeClasses[size]} rounded-xl font-medium tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-[#533F31]/40 transition relative`
  
  const variantClasses = {
    primary: [
      'bg-[#E9C46A] text-[#2E2A25] ring-1 ring-[#533F31]',
      'shadow-[0_2px_0_rgba(83,63,49,0.5)] hover:translate-y-[-1px] active:translate-y-0',
      'hover:shadow-[0_4px_0_rgba(83,63,49,0.45)]',
    ].join(' '),
    ghost: [
      'bg-[#F8F1E3] text-[#2E2A25] ring-1 ring-[#533F31]/20',
      'hover:bg-[#F0E4CC]',
    ].join(' '),
    outlined: [
      'bg-transparent text-[#2E2A25] ring-1 ring-[#533F31]',
      'before:absolute before:top-1 before:left-1 before:w-2 before:h-2',
      'before:border-l-2 before:border-t-2 before:border-[#533F31] before:rounded-tl',
      'after:absolute after:bottom-1 after:right-1 after:w-2 after:h-2',
      'after:border-r-2 after:border-b-2 after:border-[#533F31] after:rounded-br',
    ].join(' '),
    danger: [
      'bg-[#C86B6B] text-white ring-1 ring-[#533F31]/20',
      'shadow-[0_2px_0_rgba(83,63,49,0.5)] hover:translate-y-[-1px] active:translate-y-0',
    ].join(' '),
  }

  return (
    <button
      {...props}
      className={[baseClasses, variantClasses[variant], className].join(' ')}
    >
      {children}
    </button>
  )
}
