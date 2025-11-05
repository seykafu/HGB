import mascotImage from '../../assets/mascot.png'

export function Mascot({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <img
      src={mascotImage}
      alt="Paralogue Mascot"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}
