import { useId } from 'react'
import { cn } from '@/lib/utils'

const LAYOUT: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[73, 27], [27, 73]],
  3: [[73, 27], [50, 50], [27, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [27, 50], [27, 75], [73, 25], [73, 50], [73, 75]],
}

// One face of the die, drawn flat: onyx with the pips inlaid in the
// assistant's colour. Used for the face picker and as the stand-in when the
// 3D scene cannot run.
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
      <defs>
        <linearGradient id={lightId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2c31" />
          <stop offset="0.55" stopColor="#141518" />
          <stop offset="1" stopColor="#0c0d0f" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="96" height="96" rx="22" fill={`url(#${lightId})`} />
      <rect x="2.5" y="2.5" width="95" height="95" rx="21.5" fill="none" stroke="#fff" strokeOpacity="0.1" />
      {LAYOUT[pips].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={pips === 1 ? 12.5 : 8.6} fill={color} />
          <circle cx={x} cy={y} r={pips === 1 ? 11.8 : 7.9} fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth="1.4" />
        </g>
      ))}
    </svg>
  )
}
