'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ProtokollDruck } from '@/components/ProtokollDruck'
import { ZusammenfassungDruck } from '@/components/ZusammenfassungDruck'
import { AUSDRUCK_LEER, ladeAusdruck, type ProtokollAusdruck } from '@/lib/einstellungen'
import { protokolliere } from '@/lib/konto'
import { ladeAkten, ladeInhalt, ladeSitzungen, type Sitzung } from '@/lib/protokolle/daten'
import type { Inhalt } from '@/lib/protokolle/modell'
import { useTresor } from '@/lib/tresor'

// Sammeldruck: mehrere Protokolle (Auswahl aus der Liste, ?ids=… in der Reihenfolge der Liste) entschlüsseln; wahlweise
// Zusammenfassungsseite (?mit=zusammenfassung), Protokolle je auf eigener Seite (?mit=protokolle) oder beides.
type Teil = { s: Sitzung; chiffre: string; inhalt: Inhalt; fassungen: number }

export default function Sammeldruck() {
  const tresor = useTresor()
  const [teile, setTeile] = useState<Teil[] | null>(null)
  const [ausdruck, setAusdruck] = useState<ProtokollAusdruck>(AUSDRUCK_LEER)
  const [fehler, setFehler] = useState('')
  const [fortschritt, setFortschritt] = useState('')
  const gedruckt = useRef(false)
  const [mit, setMit] = useState({ zusammenfassung: false, protokolle: true })

  useEffect(() => {
    (async () => {
      const q = new URLSearchParams(location.search)
      const ids = (q.get('ids') ?? '').split(',').filter(Boolean)
      const m = q.get('mit') ?? 'protokolle'
      setMit({ zusammenfassung: m !== 'protokolle', protokolle: m !== 'zusammenfassung' })
      const [akten, alle, a] = await Promise.all([ladeAkten(), ladeSitzungen(), ladeAusdruck().catch(() => AUSDRUCK_LEER)])
      const chiffreVon = new Map(akten.map((x) => [x.id, x.chiffre]))
      const nachId = new Map(alle.map((s) => [s.id, s]))
      const gewaehlt = ids.map((id) => nachId.get(id)).filter((s): s is Sitzung => !!s)
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
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-normal text-text"><input type="checkbox" checked={mit.zusammenfassung} onChange={(e) => setMit({ ...mit, zusammenfassung: e.target.checked })} /> Zusammenfassung</label>
          <label className="flex items-center gap-2 text-sm font-normal text-text"><input type="checkbox" checked={mit.protokolle} onChange={(e) => setMit({ ...mit, protokolle: e.target.checked })} /> Protokolle</label>
          <Link href="/protokolle" className="btn btn-ghost no-underline">← Zurück zur Liste</Link>
          <button className="btn btn-cta" disabled={!teile?.length || (!mit.zusammenfassung && !mit.protokolle)} onClick={() => print()}>Drucken / PDF ({teile?.length ?? 0})</button>
        </div>
      </div>
      {fehler && <p className="fehler" role="alert">{fehler}</p>}
      {!teile && !fehler && <p className="text-text-muted">{fortschritt || 'Wird geladen …'}</p>}
      {teile && !teile.length && <p className="text-text-muted">Keine Protokolle ausgewählt. <Link href="/protokolle">Zurück zur Liste</Link> und Häkchen setzen.</p>}
      {teile && teile.length > 0 && mit.zusammenfassung && (
        <article className="rounded-lg bg-surface p-6 shadow-sm print:rounded-none print:bg-transparent print:p-0 print:shadow-none"
          style={{ breakAfter: mit.protokolle ? 'page' : 'auto' }}>
          <ZusammenfassungDruck zeilen={teile} ausdruck={ausdruck} />
        </article>
      )}
      {mit.protokolle && teile?.map((t, i) => (
        <article key={t.s.id} className="rounded-lg bg-surface p-6 shadow-sm print:rounded-none print:bg-transparent print:p-0 print:shadow-none"
          style={{ breakAfter: i < teile.length - 1 ? 'page' : 'auto' }}>
          <ProtokollDruck art={t.s.art} nr={t.s.nr} chiffre={t.chiffre} kopf={t.s} inhalt={t.inhalt} entwurf={t.s.protokoll_status === 'entwurf'}
            abgeschlossenAm={t.s.abgeschlossen_am} fassungen={t.fassungen} ausdruck={ausdruck} />
        </article>
      ))}
    </div>
  )
}
