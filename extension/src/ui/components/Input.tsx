import React from 'react'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'h-10 px-3 rounded-lg bg-[#FBF7EF] text-[#2E2A25]',
        'ring-1 ring-[#533F31]/30',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_0_rgba(0,0,0,0.05)]',
        'placeholder:text-[#2E2A25]/50',
        'focus:outline-none focus:ring-2 focus:ring-[#533F31]/40',
        props.className,
      ].join(' ')}
    />
  )
}

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>((props, ref) => {
  return (
    <textarea
      {...props}
      ref={ref}
      className={[
        'px-3 py-2 rounded-lg bg-[#FBF7EF] text-[#2E2A25]',
        'ring-1 ring-[#533F31]/30',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_0_rgba(0,0,0,0.05)]',
        'placeholder:text-[#2E2A25]/50 resize-none',
        'focus:outline-none focus:ring-2 focus:ring-[#533F31]/40',
        props.className,
      ].join(' ')}
    />
  )
})

Textarea.displayName = 'Textarea'
