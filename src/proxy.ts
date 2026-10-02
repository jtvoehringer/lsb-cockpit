import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Seiten ohne Anmeldung. Alles andere verlangt eine Supabase-Sitzung; die Daten selbst schützt zusätzlich RLS (AAL2) und die Verschlüsselung.
const OEFFENTLICH = ['/anmelden', '/einrichten']

function csp(nonce: string) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const dev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self'${dev ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabase} ${supabase.replace('https://', 'wss://')}${dev ? ' ws://localhost:*' : ''}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const policy = csp(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', policy)

  let antwort = NextResponse.next({ request: { headers: requestHeaders } })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(neu) {
        neu.forEach(({ name, value }) => request.cookies.set(name, value))
        antwort = NextResponse.next({ request: { headers: requestHeaders } })
        neu.forEach(({ name, value, options }) => antwort.cookies.set(name, value, options))
      },
    },
  })
  // Sitzung auffrischen – kein Code zwischen createServerClient und getUser
  const { data: { user } } = await supabase.auth.getUser()

  const pfad = request.nextUrl.pathname
  if (!user && !OEFFENTLICH.some((p) => pfad === p || pfad.startsWith(p + '/'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/anmelden'
    url.search = ''
    const umleitung = NextResponse.redirect(url)
    umleitung.headers.set('Content-Security-Policy', policy)
    return umleitung
  }
  antwort.headers.set('Content-Security-Policy', policy)
  return antwort
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico|apple-icon.png|manifest.webmanifest|brand/|asr/).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }] }],
}
