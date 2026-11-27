import type { MetadataRoute } from 'next'

const SHORTCUT_ICONS = [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }]

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
    // Shared links and text open as a draft in a new chat.
    share_target: {
      action: '/share-target',
      method: 'GET',
      params: { title: 'title', text: 'text', url: 'url' },
    },
    shortcuts: [
      { name: 'New chat', url: '/?new=1', icons: SHORTCUT_ICONS },
      { name: 'Research with Pulse', short_name: 'Research', url: '/?new=1&assistant=pulse', icons: SHORTCUT_ICONS },
      { name: 'Make an image', short_name: 'Image', url: '/?new=1&assistant=prism', icons: SHORTCUT_ICONS },
    ],
  }
}
