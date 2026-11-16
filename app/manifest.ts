import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zenquanta AI',
    short_name: 'Zenquanta',
    description: 'Six AI specialists and Forge, the coding agent, in one workspace.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0f1012',
    theme_color: '#0f1012',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
