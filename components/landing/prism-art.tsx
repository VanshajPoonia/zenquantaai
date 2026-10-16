import { useId } from 'react'
import { cn } from '@/lib/utils'

// The example image in the hero's Prism chat: a figure in a rain-lit alley,
// drawn as vector art so the page ships no raster for it.
export function PrismArt({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label="Example image: a figure in a rain-lit alley at night" className={cn('block', className)}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a0b17" />
          <stop offset="0.55" stopColor="#1a1020" />
          <stop offset="1" stopColor="#07070c" />
        </linearGradient>
        <radialGradient id={`${id}-far`} cx="0.5" cy="0.46" r="0.32">
          <stop offset="0" stopColor="#ffb27a" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#ff7a45" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff7a45" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120c14" />
          <stop offset="1" stopColor="#050507" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <pattern id={`${id}-rain`} width="14" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
          <line x1="3" y1="0" x2="3" y2="9" stroke="#cfe6ff" strokeOpacity="0.22" strokeWidth="0.8" />
          <line x1="10" y1="11" x2="10" y2="17" stroke="#cfe6ff" strokeOpacity="0.14" strokeWidth="0.7" />
        </pattern>
      </defs>

      <rect width="320" height="240" fill={`url(#${id}-sky)`} />
      <rect width="320" height="240" fill={`url(#${id}-far)`} />

      {/* Far end of the alley */}
      <rect x="138" y="70" width="44" height="78" fill="#2a1416" opacity="0.7" />
      <rect x="146" y="80" width="10" height="14" rx="1.5" fill="#ffcf8a" opacity="0.8" />
      <rect x="163" y="86" width="9" height="12" rx="1.5" fill="#ffcf8a" opacity="0.55" />

      {/* Walls */}
      <path d="M0 0 L138 62 L138 156 L0 240 Z" fill="#0c0d14" />
      <path d="M320 0 L182 62 L182 156 L320 240 Z" fill="#0d0c13" />
      <path d="M138 62 L138 156" stroke="#ff9a5c" strokeOpacity="0.25" />
      <path d="M182 62 L182 156" stroke="#ff9a5c" strokeOpacity="0.2" />

      {/* Signs, with their glow */}
      <g filter={`url(#${id}-glow)`} opacity="0.9">
        <rect x="58" y="58" width="14" height="66" rx="3" fill="#ff7a3d" />
        <rect x="248" y="52" width="16" height="54" rx="3" fill="#ff4fa0" />
        <rect x="214" y="122" width="34" height="10" rx="3" fill="#36d2ff" />
      </g>
      <rect x="58" y="58" width="14" height="66" rx="3" fill="#ffb07a" />
      <rect x="248" y="52" width="16" height="54" rx="3" fill="#ff8cc4" />
      <rect x="214" y="122" width="34" height="10" rx="3" fill="#9ae9ff" />
      <g fill="#2a120a" opacity="0.55">
        <rect x="62" y="66" width="6" height="6" rx="1" />
        <rect x="62" y="78" width="6" height="6" rx="1" />
        <rect x="62" y="90" width="6" height="6" rx="1" />
        <rect x="62" y="102" width="6" height="6" rx="1" />
      </g>

      {/* Wet floor and reflections */}
      <path d="M0 240 L138 156 L182 156 L320 240 Z" fill={`url(#${id}-floor)`} />
      <g filter={`url(#${id}-soft)`} opacity="0.75">
        <rect x="56" y="168" width="18" height="70" rx="6" fill="#ff7a3d" opacity="0.6" />
        <rect x="246" y="164" width="18" height="70" rx="6" fill="#ff4fa0" opacity="0.5" />
        <rect x="212" y="150" width="38" height="40" rx="6" fill="#36d2ff" opacity="0.35" />
        <ellipse cx="160" cy="176" rx="38" ry="10" fill="#ffb27a" opacity="0.55" />
      </g>

      {/* The figure */}
      <g>
        <ellipse cx="160" cy="214" rx="26" ry="4" fill="#000" opacity="0.6" />
        <path
          d="M160 112 c7 0 11 5 11 12 c0 6 -3 10 -6 12 l9 4 c6 3 9 8 10 16 l4 58 h-56 l4 -58 c1 -8 4 -13 10 -16 l9 -4 c-3 -2 -6 -6 -6 -12 c0 -7 4 -12 11 -12 z"
          fill="#06060a"
        />
        <path
          d="M171 124 c0 6 -3 10 -6 12 l9 4 c6 3 9 8 10 16 l4 58"
          fill="none"
          stroke="#ffa66b"
          strokeOpacity="0.75"
          strokeWidth="1.2"
        />
        <path d="M149 124 c0 6 3 10 6 12" fill="none" stroke="#7fdcff" strokeOpacity="0.5" strokeWidth="1" />
      </g>

      {/* Rain */}
      <rect x="-24" y="-30" width="368" height="300" fill={`url(#${id}-rain)`} data-rain />
    </svg>
  )
}
