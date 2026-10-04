'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ProtokollDruck } from '@/components/ProtokollDruck'
import { AUSDRUCK_LEER, ladeAusdruck, type ProtokollAusdruck } from '@/lib/einstellungen'
import { protokolliere } from '@/lib/konto'
import { ladeAkten, ladeInhalt, ladeSitzungen, type Sitzung } from '@/lib/protokolle/daten'
import type { Inhalt } from '@/lib/protokolle/modell'
import { useTresor } from '@/lib/tresor'

// Sammeldruck: mehrere Protokolle (Auswahl aus der Liste, ?ids=…) entschlüsseln und je Protokoll auf einer eigenen Seite drucken.
type Teil = { s: Sitzung; chiffre: string; inhalt: Inhalt; fassungen: number }

export default function Sammeldruck() {
  const tresor = useTresor()
  const [teile, setTeile] = useState<Teil[] | null>(null)
  const [ausdruck, setAusdruck] = useState<ProtokollAusdruck>(AUSDRUCK_LEER)
  const [fehler, setFehler] = useState('')
  const [fortschritt, setFortschritt] = useState('')
  const gedruckt = useRef(false)

  useEffect(() => {
    (async () => {
      const ids = new Set((new URLSearchParams(location.search).get('ids') ?? '').split(',').filter(Boolean))
      const [akten, alle, a] = await Promise.all([ladeAkten(), ladeSitzungen(), ladeAusdruck().catch(() => AUSDRUCK_LEER)])
      const chiffreVon = new Map(akten.map((x) => [x.id, x.chiffre]))
      const gewaehlt = alle.filter((s) => ids.has(s.id)).sort((x, y) => x.datum.localeCompare(y.datum) || x.nr - y.nr)
      const out: Teil[] = []
      for (const s of gewaehlt) {
        setFortschritt(`${out.length + 1} von ${gewaehlt.length} wird entschlüsselt …`)
        const { inhalt, versionen } = await ladeInhalt(tresor.schluessel('zone_b'), s)
        out.push({ s, chiffre: chiffreVon.get(s.akte_id) ?? '', inhalt, fassungen: versionen.length })
      }
      setAusdruck(a); setTeile(out); setFortschritt('')
      if (out.length) await protokolliere('protokolle_gedruckt', `${out.length} Protokolle`)
    })().catch((e) => setFehler((e as Error).message))
  }, [tresor])

  // Druckdialog einmal automatisch öffnen, sobald alles geladen ist
  useEffect(() => {
    if (!teile?.length || gedruckt.current) return
    gedruckt.current = true
    const t = setTimeout(() => print(), 400)
    return () => clearTimeout(t)
  }, [teile])

  return (
    <div className="space-y-6">
      <div className="nicht-drucken flex flex-wrap items-end justify-between gap-3">
        <div><p className="overline"><Link href="/protokolle" className="no-underline">Protokolle</Link></p><h1 className="mt-2 font-heading text-heading">Protokolle drucken</h1></div>
        <div className="flex flex-wrap gap-2">
          <Link href="/protokolle" className="btn btn-ghost no-underline">← Zurück zur Liste</Link>
          <button className="btn btn-cta" disabled={!teile?.length} onClick={() => print()}>Drucken / PDF ({teile?.length ?? 0})</button>
        </div>
      </div>
      {fehler && <p className="fehler" role="alert">{fehler}</p>}
      {!teile && !fehler && <p className="text-text-muted">{fortschritt || 'Wird geladen …'}</p>}
      {teile && !teile.length && <p className="text-text-muted">Keine Protokolle ausgewählt. <Link href="/protokolle">Zurück zur Liste</Link> und Häkchen setzen.</p>}
      {teile?.map((t, i) => (
        <article key={t.s.id} className="rounded-lg bg-surface p-6 shadow-sm print:rounded-none print:bg-transparent print:p-0 print:shadow-none"
          style={{ breakAfter: i < teile.length - 1 ? 'page' : 'auto' }}>
          <ProtokollDruck art={t.s.art} nr={t.s.nr} chiffre={t.chiffre} kopf={t.s} inhalt={t.inhalt} entwurf={t.s.protokoll_status === 'entwurf'}
            abgeschlossenAm={t.s.abgeschlossen_am} fassungen={t.fassungen} ausdruck={ausdruck} />
        </article>
      ))}
    </div>
  )
}
