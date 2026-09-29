import type { NextConfig } from 'next'

// Sicherheits-Header (Lösungsdesign 4.5). Die Content-Security-Policy mit Nonce setzt src/proxy.ts je Anfrage.
const sicherheitsHeader = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    // Für „Schutz & Audit“: welche Version läuft gerade?
    NEXT_PUBLIC_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'lokal').slice(0, 7),
    NEXT_PUBLIC_BUILD_ZEIT: new Date().toISOString(),
  },
  async headers() {
    return [
      { source: '/:path*', headers: sicherheitsHeader },
      // Anwendungsseiten nie zwischenspeichern
      { source: '/((?!_next/static|_next/image|favicon.ico|brand/|asr/).*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      // Sprach-Worker: Programmcode nur aus dem eigenen Repository, Modelldateien (gepinnt) von Hugging Face – sonst nichts,
      // insbesondere kein Zugriff auf Supabase
      {
        source: '/asr/:path*',
        headers: [{ key: 'Content-Security-Policy', value: "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' blob:; connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co blob: data:" }],
      },
    ]
  },
}

export default nextConfig
