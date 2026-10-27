import type { MetadataRoute } from 'next';

/**
 * What a phone needs to keep the app on its home screen and open it full
 * screen. iOS reads the name and display mode from here, and its icon from
 * the apple-touch-icon in layout.
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Meals',
    short_name: 'Meals',
    description: 'Meal ideas that fit her plan.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f5f1',
    theme_color: '#f4f5f1',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
