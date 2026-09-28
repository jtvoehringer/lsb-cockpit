import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, Newsreader } from 'next/font/google'
import { headers } from 'next/headers'
import brand from '@/config/brand.config'
import { TresorProvider } from '@/lib/tresor'
import './globals.css'

// Schriften werden beim Build geladen und von der eigenen Domain ausgeliefert – der Browser fragt nie bei Google an.
const newsreader = Newsreader({ subsets: ['latin', 'latin-ext'], axes: ['opsz'], style: ['normal', 'italic'], variable: '--font-newsreader', display: 'swap' })
const instrumentSans = Instrument_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-instrument-sans', display: 'swap' })

export const metadata: Metadata = {
  title: { default: brand.appName, template: `%s · ${brand.appName}` },
  robots: { index: false, follow: false },
}
export const viewport: Viewport = { themeColor: brand.colors.palette.forest }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers() // dynamisch rendern: jede Antwort bekommt eine eigene CSP-Nonce (proxy.ts)
  return (
    <html lang="de" className={`${newsreader.variable} ${instrumentSans.variable}`}>
      <body>
        <TresorProvider>{children}</TresorProvider>
      </body>
    </html>
  )
}
