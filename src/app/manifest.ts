import type { MetadataRoute } from 'next'
import brand from '@/config/brand.config'

// Installierbar als App (PWA) – bewusst ohne Service Worker: kein zwischengespeicherter Programmcode,
// jede Sitzung lädt den aktuellen, geprüften Stand vom Server (Sicherheitskonzept, B-01). Offline geht nichts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: brand.appName,
    short_name: 'Cockpit',
    description: 'Praxis-Cockpit mit Ende-zu-Ende-Verschlüsselung',
    lang: 'de-AT',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: brand.colors.palette.linen,
    theme_color: brand.colors.palette.forest,
    icons: [
      { src: '/brand/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
