import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geistSans = Geist({ 
  subsets: ["latin"],
  variable: '--font-geist-sans',
})
const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'Zenquanta AI | Nova, Velora, Axiom, Forge, Pulse, Prism',
  description:
    'A premium AI workspace built around Nova, Velora, Axiom, Forge, Pulse, and Prism for general work, creativity, reasoning, coding, live research, and image generation.',
  generator: 'v0.app',
  keywords: ['AI', 'chat', 'Nova', 'Velora', 'Axiom', 'Forge', 'Pulse', 'Prism', 'creative', 'reasoning', 'coding', 'image generation'],
  authors: [{ name: 'Zenquanta' }],
  icons: {
    icon: '/file.svg',
    shortcut: '/file.svg',
    apple: '/file.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
