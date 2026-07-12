'use client'

import { cn } from '@/lib/utils'
import { AIMode } from '@/lib/types'

// The six assistants, in the fixed order they're introduced everywhere else
// in the product (mode switcher, sidebar icons, pricing tiers). Keeping this
// order is what makes the arc read as "the same six things, refracted" —
// see AI_DECISIONS.md "Spectrum Arc Is The Product Signature".
const ARC_MODES: AIMode[] = ['general', 'creative', 'logic', 'code', 'live', 'image']

const MODE_VAR: Record<AIMode, string> = {
  general: 'var(--general)',
  creative: 'var(--creative)',
  logic: 'var(--logic)',
  code: 'var(--code)',
  live: 'var(--live)',
  image: 'var(--image)',
}

interface SpectrumArcProps {
  activeMode?: AIMode
  className?: string
}

const CX = 160
const CY = 176
const RADIUS = 150
// 195deg -> 345deg sweeps the *upper* semicircle (SVG y grows downward, so
// angles in (180, 360) sit above center) — this is what makes it read as a
// rainbow/prism arc bowing up over the hero icon, not a hanging pair of pins.
const START_ANGLE = 195
const END_ANGLE = 345

function pointFor(index: number, total: number) {
  const t = index / (total - 1)
  const angleDeg = START_ANGLE + (END_ANGLE - START_ANGLE) * t
  const angle = (angleDeg * Math.PI) / 180
  return {
    x: CX + RADIUS * Math.cos(angle),
    y: CY + RADIUS * Math.sin(angle),
  }
}

export function SpectrumArc({ activeMode, className }: SpectrumArcProps) {
  const points = ARC_MODES.map((mode, index) => ({
    mode,
    ...pointFor(index, ARC_MODES.length),
  }))

  const pathD = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ')

  return (
    <svg
      viewBox="0 0 320 190"
      className={cn('pointer-events-none', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spectrum-arc-line" x1="0" y1="0" x2="1" y2="0">
          {ARC_MODES.map((mode, index) => (
            <stop
              key={mode}
              offset={`${(index / (ARC_MODES.length - 1)) * 100}%`}
              stopColor={MODE_VAR[mode]}
            />
          ))}
        </linearGradient>
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke="url(#spectrum-arc-line)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      {points.map((point) => {
        const isActive = point.mode === activeMode
        return (
          <circle
            key={point.mode}
            cx={point.x}
            cy={point.y}
            r={isActive ? 5.5 : 3}
            fill={MODE_VAR[point.mode]}
            opacity={isActive ? 1 : 0.4}
            style={
              isActive
                ? { filter: `drop-shadow(0 0 8px ${MODE_VAR[point.mode]})` }
                : undefined
            }
          />
        )
      })}
    </svg>
  )
}
