export function Swords({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Left sword */}
      <line x1="12" y1="36" x2="24" y2="12" />
      <line x1="16" y1="32" x2="28" y2="8" />
      {/* Right sword */}
      <line x1="36" y1="36" x2="24" y2="12" />
      <line x1="32" y1="32" x2="20" y2="8" />
      {/* Cross point */}
      <circle cx="24" cy="12" r="2" fill="currentColor" />
      {/* Hilts */}
      <rect x="10" y="36" width="4" height="8" rx="1" fill="currentColor" />
      <rect x="34" y="36" width="4" height="8" rx="1" fill="currentColor" />
    </svg>
  )
}
