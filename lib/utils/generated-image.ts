import { AIMode, Attachment } from '@/types'
import { createId, nowIso } from '@/lib/utils/chat'

const MODE_IMAGE_PALETTES: Record<
  AIMode,
  { from: string; to: string; accent: string; glow: string }
> = {
  general: {
    from: '#073b3a',
    to: '#0f766e',
    accent: '#2dd4bf',
    glow: '#99f6e4',
  },
  creative: {
    from: '#341037',
    to: '#7c3aed',
    accent: '#f472b6',
    glow: '#f5d0fe',
  },
  logic: {
    from: '#0f2342',
    to: '#1d4ed8',
    accent: '#60a5fa',
    glow: '#bfdbfe',
  },
  code: {
    from: '#0b2615',
    to: '#15803d',
    accent: '#4ade80',
    glow: '#bbf7d0',
  },
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function wrapLines(input: string, limit = 26, maxLines = 4): string[] {
  const words = input.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['Untitled concept']

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (`${current} ${word}`.trim().length > limit && current) {
      lines.push(current)
      current = word
      if (lines.length === maxLines) break
    } else {
      current = `${current} ${word}`.trim()
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current)
  }

  return lines.slice(0, maxLines)
}

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export function buildGeneratedImageCaption(prompt: string): string {
  return `Created a visual concept based on your prompt: "${prompt.trim()}"`
}

export function createGeneratedImageAttachment(
  prompt: string,
  mode: AIMode
): Attachment {
  const palette = MODE_IMAGE_PALETTES[mode]
  const lines = wrapLines(prompt)
  const safeLines = lines.map(escapeXml)
  const safePrompt = escapeXml(prompt.trim())

  const svg = `
<svg width="1200" height="900" viewBox="0 0 1200 900" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="900" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.from}" />
      <stop offset="1" stop-color="${palette.to}" />
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(840 220) rotate(135) scale(360 260)">
      <stop stop-color="${palette.glow}" stop-opacity="0.5" />
      <stop offset="1" stop-color="${palette.glow}" stop-opacity="0" />
    </radialGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="24" />
    </filter>
  </defs>
  <rect width="1200" height="900" rx="48" fill="url(#bg)" />
  <circle cx="840" cy="220" r="260" fill="url(#glow)" filter="url(#blur)" />
  <circle cx="270" cy="720" r="220" fill="${palette.accent}" opacity="0.16" filter="url(#blur)" />
  <rect x="72" y="72" width="1056" height="756" rx="40" fill="rgba(5,8,12,0.18)" stroke="rgba(255,255,255,0.08)" />
  <rect x="116" y="116" width="968" height="668" rx="28" fill="rgba(7,10,15,0.28)" stroke="rgba(255,255,255,0.08)" />
  <text x="146" y="186" fill="rgba(255,255,255,0.72)" font-family="Inter, Arial, sans-serif" font-size="22" letter-spacing="6">ZENQUANTA VISUAL</text>
  <text x="146" y="282" fill="white" font-family="Inter, Arial, sans-serif" font-size="74" font-weight="700">
    ${safeLines
      .map(
        (line, index) =>
          `<tspan x="146" dy="${index === 0 ? 0 : 84}">${line}</tspan>`
      )
      .join('')}
  </text>
  <text x="146" y="628" fill="rgba(255,255,255,0.78)" font-family="Inter, Arial, sans-serif" font-size="28">
    Prompt
  </text>
  <foreignObject x="146" y="654" width="620" height="110">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:rgba(255,255,255,0.72);font-family:Inter,Arial,sans-serif;font-size:24px;line-height:1.45;">
      ${safePrompt}
    </div>
  </foreignObject>
  <rect x="858" y="618" width="160" height="160" rx="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
  <path d="M914 724l38-52 30 40 24-30 44 42" stroke="${palette.accent}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="938" cy="652" r="18" fill="${palette.accent}" opacity="0.95" />
</svg>`.trim()

  return {
    id: createId('att'),
    kind: 'image',
    name: 'generated-concept.svg',
    mimeType: 'image/svg+xml',
    size: svg.length,
    createdAt: nowIso(),
    previewUrl: toDataUrl(svg),
    textContent: prompt.trim(),
    textExcerpt: prompt.trim().slice(0, 240),
  }
}
