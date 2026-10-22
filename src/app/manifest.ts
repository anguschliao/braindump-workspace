import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Sotaria Workspace',
    short_name: 'Sotaria Workspace',
    description: 'Your shared Sotaria thoughts, boards, tasks and calendar.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf9f6',
    theme_color: '#365e47',
    lang: 'en',
    prefer_related_applications: false,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
