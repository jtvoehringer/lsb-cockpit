'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { datum, stunden, zahl } from '@/lib/format'
import { ladeAkten, ladeSitzungen, neueAkte, neueSitzung, type Akte, type Sitzung } from '@/lib/protokolle/daten'
import { ART, minuten } from '@/lib/protokolle/modell'
import { protokolliere } from '@/lib/konto'
import { useTresor } from '@/lib/tresor'

export default function Protokolle() {
  const router = useRouter()
  const tresor = useTresor()
  const [akten, setAkten] = useState<Akte[]>([])
  const [sitzungen, setSitzungen] = useState<Sitzung[] | null>(null)
  const [filter, setFilter] = useState({ chiffre: '', von: '', bis: '' })
  const [folgeAkte, setFolgeAkte] = useState('')
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    const c = new URLSearchParams(location.search).get('chiffre')
    if (c) setFilter((f) => ({ ...f, chiffre: c }))
    Promise.all([ladeAkten(), ladeSitzungen()]).then(([a, s]) => { setAkten(a); setSitzungen(s) }).catch((e) => setFehler(e.message))
  }, [])

  const chiffreVon = useMemo(() => new Map(akten.map((a) => [a.id, a.chiffre])), [akten])
  const ohneEinwilligung = useMemo(() => new Set(akten.filter((a) => a.status === 'offen' && !a.einwilligung_am).map((a) => a.id)), [akten])
  const zeilen = (sitzungen ?? []).filter((s) =>
    (!filter.chiffre || (chiffreVon.get(s.akte_id) ?? '').toLowerCase().includes(filter.chiffre.toLowerCase())) &&
    (!filter.von || s.datum >= filter.von) && (!filter.bis || s.datum <= filter.bis))

  async function erstgespraech() {
    setArbeitet(true); setFehler('')
    try {
      const akte = await neueAkte(tresor.schluessel('zone_c'))
      const s = await neueSitzung(akte.id, 'erst')
      await protokolliere('akte_angelegt', akte.chiffre)
      router.push(`/protokolle/${s.id}`)
    } catch (e) { setFehler((e as Error).message); setArbeitet(false) }
  }

  async function beratungsgespraech() {
    if (!folgeAkte) { setFehler('Bitte zuerst die Chiffre wählen.'); return }
    setArbeitet(true); setFehler('')
    try {
      const s = await neueSitzung(folgeAkte, 'folge')
      router.push(`/protokolle/${s.id}`)
    } catch (e) { setFehler((e as Error).message); setArbeitet(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="overline">Dokumentation</p><h1 className="mt-2 font-heading text-heading">Protokolle</h1></div>
        <div className="flex flex-wrap items-end gap-2">
          <button className="btn btn-cta" onClick={erstgespraech} disabled={arbeitet}>+ Erstgespräch (neue Chiffre)</button>
          <label className="min-w-44">Beratungsgespräch zu
            <select value={folgeAkte} onChange={(e) => setFolgeAkte(e.target.value)} className="mt-1 block w-full rounded-md border border-border-input bg-surface px-3 py-2.5 text-base">
              <option value="">Chiffre wählen …</option>
              {akten.filter((a) => a.status === 'offen').map((a) => <option key={a.id} value={a.id}>{a.chiffre}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={beratungsgespraech} disabled={arbeitet}>+ Beratungsgespräch</button>
        </div>
      </div>
      {fehler && <p className="fehler" role="alert">{fehler}</p>}
      {ohneEinwilligung.size > 0 && <p className="hinweis text-sm">Bei {ohneEinwilligung.size} offenen Akte{ohneEinwilligung.size === 1 ? '' : 'n'} ist noch keine Einwilligung zur Verarbeitung der Gesundheitsdaten erfasst. Nachtragen im <Link href="/register">Register</Link> unter „Stammdaten“.</p>}

      <div className="flex flex-wrap gap-3">
        <label>Chiffre<input value={filter.chiffre} onChange={(e) => setFilter({ ...filter, chiffre: e.target.value })} placeholder="alle" /></label>
        <label>von<input type="date" value={filter.von} onChange={(e) => setFilter({ ...filter, von: e.target.value })} /></label>
        <label>bis<input type="date" value={filter.bis} onChange={(e) => setFilter({ ...filter, bis: e.target.value })} /></label>
      </div>

      <div className="karte overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-widest text-text-subtle">
            {['Nr.', 'Datum', 'Chiffre', 'Art', 'Dauer', 'Einheiten', 'Status'].map((h, i) => <th key={h} className={`px-4 py-3 font-medium ${i >= 4 && i <= 5 ? 'text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {zeilen.map((s) => {
              const m = minuten(s.beginn, s.ende)
              return (
                <tr key={s.id} className="border-t border-border hover:bg-background">
                  <td className="px-4 py-3 tabular-nums"><Link href={`/protokolle/${s.id}`} className="no-underline">{s.nr}</Link></td>
                  <td className="px-4 tabular-nums"><Link href={`/protokolle/${s.id}`} className="no-underline">{datum(s.datum)}</Link></td>
                  <td className="px-4 tabular-nums">{chiffreVon.get(s.akte_id)}{ohneEinwilligung.has(s.akte_id) && <span title="Einwilligung (Art. 9 DSGVO) noch nicht erfasst – im Register unter „Stammdaten“" className="ml-2 whitespace-nowrap rounded-full bg-sand px-2 py-0.5 text-xs">Einwilligung fehlt</span>}</td>
                  <td className="px-4">{ART[s.art].kurz}</td>
                  <td className="px-4 text-right tabular-nums">{m ? `${stunden(m)} h` : '–'}</td>
                  <td className="px-4 text-right tabular-nums">{m ? zahl(s.arbeitseinheiten ?? 0) : '–'}</td>
                  <td className="px-4">{s.protokoll_status === 'abgeschlossen'
                    ? <span className="rounded-full bg-sage/30 px-2 py-0.5 text-xs text-forest-deep">abgeschlossen</span>
                    : <span className="rounded-full bg-sand px-2 py-0.5 text-xs">Entwurf</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {sitzungen && zeilen.length === 0 && <p className="p-6 text-text-muted">{sitzungen.length ? 'Keine Treffer.' : 'Noch keine Protokolle. Oben ein Erstgespräch anlegen – oder im Register eine Klientin anlegen und dort das Erstgespräch beginnen.'}</p>}
        {!sitzungen && !fehler && <p className="p-6 text-text-muted">Wird geladen …</p>}
      </div>
    </div>
  )
}
