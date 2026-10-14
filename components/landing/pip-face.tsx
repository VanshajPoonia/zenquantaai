import { useId } from 'react'
import { cn } from '@/lib/utils'

const LAYOUT: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[74, 26], [26, 74]],
  3: [[74, 26], [50, 50], [26, 74]],
  4: [[26, 26], [74, 26], [26, 74], [74, 74]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[26, 24], [26, 50], [26, 76], [74, 24], [74, 50], [74, 76]],
}

// One face of the die, drawn flat. Used for the face picker, the cards and as
// the stand-in when the 3D scene cannot run.
export function PipFace({
  pips,
  color,
  className,
}: {
  pips: number
  color: string
  className?: string
}) {
  const lightId = `pip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={cn('block', className)}>
      <rect x="2" y="2" width="96" height="96" rx="20" fill={color} />
      <rect x="2" y="2" width="96" height="96" rx="20" fill={`url(#${lightId})`} />
      <defs>
        <linearGradient id={lightId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      {LAYOUT[pips].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="8.4" fill="#0c1f18" />
      ))}
    </svg>
  )
}
