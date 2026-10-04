'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Meldungen } from '@/components/Meldungen'
import brand from '@/config/brand.config'
import { abmelden, protokolliere } from '@/lib/konto'
import { useTresor } from '@/lib/tresor'

/** Bereich hinter dem Tresor: ohne entpackte Schlüssel geht es zur Entsperrseite. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const tresor = useTresor()
  const router = useRouter()
  const pfad = usePathname()

  const [menuOffen, setMenuOffen] = useState(false)

  useEffect(() => { if (!tresor.offen) router.replace('/entsperren') }, [tresor.offen, router])
  useEffect(() => { setMenuOffen(false) }, [pfad]) // nach Seitenwechsel Menü am Handy schließen
  if (!tresor.offen) return null

  const nav = [
    { href: '/', text: 'Übersicht' }, { href: '/protokolle', text: 'Protokolle' }, { href: '/nachweis', text: 'Nachweis' },
    { href: '/register', text: 'Register' }, { href: '/fristen', text: 'Fristen' }, { href: '/vorlagen', text: 'Vorlagen' }, { href: '/finanzen', text: 'Finanzen' }, { href: '/schutz', text: 'Schutz & Audit' }, { href: '/einstellungen', text: 'Einstellungen' }, { href: '/hilfe', text: 'Hilfe' },
  ]
  return (
    <div className="min-h-screen">
      <header className="nicht-drucken sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <img src="/brand/bildmarke.svg" alt="" width={29} height={22} />
            <span className="font-heading text-lg text-heading">{brand.appName}</span>
          </Link>
          <div className="flex gap-2 lg:hidden">
            <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm" onClick={async () => { await protokolliere('gesperrt'); tresor.sperren() }}>Sperren</button>
            <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm" aria-expanded={menuOffen} aria-controls="hauptmenue" onClick={() => setMenuOffen(!menuOffen)}>
              {menuOffen ? '✕ Schließen' : '☰ Menü'}
            </button>
          </div>
          <nav id="hauptmenue" className={`${menuOffen ? 'flex' : 'hidden'} w-full flex-col items-stretch gap-1 text-sm lg:flex lg:w-auto lg:flex-row lg:flex-wrap lg:items-center`}>
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={`rounded-full px-3 py-1.5 no-underline ${(n.href === '/' ? pfad === '/' : pfad.startsWith(n.href)) ? 'bg-sand text-heading' : 'text-text-muted hover:bg-sand'}`}>{n.text}</Link>
            ))}
            <button className="btn btn-ghost ml-2 hidden px-3 py-1.5 text-sm lg:inline-flex" onClick={async () => { await protokolliere('gesperrt'); tresor.sperren() }}>Sperren</button>
            <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={async () => { await protokolliere('abmeldung'); tresor.sperren(); await abmelden(); router.replace('/anmelden') }}>Abmelden</button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <Meldungen />
    </div>
  )
}
