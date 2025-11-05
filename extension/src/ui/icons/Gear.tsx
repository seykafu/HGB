export function Gear({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="3" />
      <path d="M10 6V2M10 18v-4M14 10h4M2 10h4M14.5 5.5l2.5-2.5M3 3l2.5 2.5M14.5 14.5l2.5 2.5M3 17l2.5-2.5" />
    </svg>
  )
}
