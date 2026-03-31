'use client'

import { cn } from '@/lib/utils'
import { AIMode } from '@/lib/types'

// Centralized mode icon component
export function ModeIcon({ 
  mode, 
  size = 'md',
  className 
}: { 
  mode: AIMode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string 
}) {
  const sizeClasses = {
    sm: 'size-4',
    md: 'size-5',
    lg: 'size-8',
    xl: 'size-12',
  }

  const iconClass = cn(sizeClasses[size], className)

  switch (mode) {
    case 'general':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4.5C8.134 4.5 5 7.41 5 11s3.134 6.5 7 6.5c.58 0 1.144-.065 1.684-.188L18.5 19l-1.31-4.25C18.31 13.68 19 12.39 19 11c0-3.59-3.134-6.5-7-6.5Z" />
          <path d="M9 10h6" />
          <path d="M9 13h4" />
        </svg>
      )
    case 'creative':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3L14.5 8.5L20 9L15.5 13L17 19L12 16L7 19L8.5 13L4 9L9.5 8.5L12 3Z" />
          <path d="M5 3V5M3 4H5M5 4H7" />
          <path d="M19 17V19M17 18H19M19 18H21" />
        </svg>
      )
    case 'logic':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5C9.239 5 7 7.239 7 10C7 11.126 7.372 12.164 8 13C7.372 13.836 7 14.874 7 16C7 18.761 9.239 21 12 21" />
          <path d="M12 5C14.761 5 17 7.239 17 10C17 11.126 16.628 12.164 16 13C16.628 13.836 17 14.874 17 16C17 18.761 14.761 21 12 21" />
          <path d="M12 5V3" />
          <path d="M9.5 8.5C10.5 9 11 10 11 10" />
          <path d="M14.5 8.5C13.5 9 13 10 13 10" />
          <path d="M9 14C10 14.5 11 15 12 15C13 15 14 14.5 15 14" />
        </svg>
      )
    case 'code':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
          <line x1="14" y1="4" x2="10" y2="20" />
        </svg>
      )
  }
}

// Mode background/accent classes
export function getModeAccentClass(mode: AIMode, type: 'bg' | 'text' | 'border' | 'ring' = 'bg') {
  const classes = {
    general: {
      bg: 'bg-general',
      text: 'text-general',
      border: 'border-general',
      ring: 'ring-general',
    },
    creative: {
      bg: 'bg-creative',
      text: 'text-creative',
      border: 'border-creative',
      ring: 'ring-creative',
    },
    logic: {
      bg: 'bg-logic',
      text: 'text-logic',
      border: 'border-logic',
      ring: 'ring-logic',
    },
    code: {
      bg: 'bg-code',
      text: 'text-code',
      border: 'border-code',
      ring: 'ring-code',
    },
  }
  return classes[mode][type]
}

export function getModeTintClass(
  mode: AIMode,
  intensity: 'subtle' | 'soft' | 'strong' = 'soft'
) {
  const classes = {
    general: {
      subtle: 'bg-general/10',
      soft: 'bg-general/15',
      strong: 'bg-general/20',
    },
    creative: {
      subtle: 'bg-creative/10',
      soft: 'bg-creative/15',
      strong: 'bg-creative/20',
    },
    logic: {
      subtle: 'bg-logic/10',
      soft: 'bg-logic/15',
      strong: 'bg-logic/20',
    },
    code: {
      subtle: 'bg-code/10',
      soft: 'bg-code/15',
      strong: 'bg-code/20',
    },
  }

  return classes[mode][intensity]
}

// Mode gradient backgrounds for premium feel
export function getModeGradient(mode: AIMode) {
  switch (mode) {
    case 'general':
      return 'bg-gradient-to-br from-general/20 via-general/5 to-transparent'
    case 'creative':
      return 'bg-gradient-to-br from-creative/20 via-creative/5 to-transparent'
    case 'logic':
      return 'bg-gradient-to-br from-logic/20 via-logic/5 to-transparent'
    case 'code':
      return 'bg-gradient-to-br from-code/20 via-code/5 to-transparent'
  }
}

// Mode glow effect
export function getModeGlow(mode: AIMode) {
  switch (mode) {
    case 'general':
      return 'shadow-[0_0_30px_-5px] shadow-general/30'
    case 'creative':
      return 'shadow-[0_0_30px_-5px] shadow-creative/30'
    case 'logic':
      return 'shadow-[0_0_30px_-5px] shadow-logic/30'
    case 'code':
      return 'shadow-[0_0_30px_-5px] shadow-code/30'
  }
}
