const TypingAnimation = () => {
  return (
    <div className="flex items-center space-x-2">
      <div className="w-2 h-2 rounded-full bg-[var(--stroke)] animate-pulse"></div>
      <div
        className="w-2 h-2 rounded-full bg-[var(--stroke)] animate-pulse"
        style={{ animationDelay: '0.2s' }}
      ></div>
      <div
        className="w-2 h-2 rounded-full bg-[var(--stroke)] animate-pulse"
        style={{ animationDelay: '0.4s' }}
      ></div>
    </div>
  )
}

export default TypingAnimation
