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
  title: 'Zenquanta AI | Premium Multi-Model Chat',
  description: 'A premium AI chat workspace for general assistance, creative writing, structured reasoning, and coding in one unified interface.',
  generator: 'v0.app',
  keywords: ['AI', 'chat', 'general assistant', 'creative writing', 'reasoning', 'code assistant'],
  authors: [{ name: 'Zenquanta' }],
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
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
