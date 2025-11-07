import React from 'react'
import mascotImage from '../../assets/mascot.png'

export function Mascot({ className = 'h-16 w-16' }: { className?: string }) {
  // In Vite, image imports return a string URL
  return (
    <img
      src={mascotImage}
      alt="GameNPC Mascot"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}
