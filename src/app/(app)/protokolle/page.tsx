'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { datum, heute, stunden, zahl } from '@/lib/format'
import { chiffreAnJahrAnpassen, ladeAkten, ladeSitzungen, neueAkte, neueSitzung, vollerName, type Akte, type Sitzung } from '@/lib/protokolle/daten'
import { ART, minuten, pruefeDatum, PROTOKOLL_AB_JAHR } from '@/lib/protokolle/modell'
import { protokolliere } from '@/lib/konto'
import { useTresor } from '@/lib/tresor'

export default function Protokolle() {
  const router = useRouter()
  const tresor = useTresor()
  const [akten, setAkten] = useState<Akte[]>([])
  const [sitzungen, setSitzungen] = useState<Sitzung[] | null>(null)
  const [filter, setFilter] = useState({ chiffre: '', von: '', bis: '' })
  const [folgeAkte, setFolgeAkte] = useState('')
  const [neu, setNeu] = useState({ datum: heute(), ausbildung: false })
  // Erstgespräch: zuerst Klient:in anlegen (Name nur verschlüsselt im Register)
  const [klient, setKlient] = useState<{ vorname: string; nachname: string; notiz: string } | null>(null)
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

  /** Chiffre wählen: Häkchen „in Ausbildung“ vom letzten Protokoll dieser Chiffre übernehmen */
  function waehleFolgeAkte(id: string) {
    setFolgeAkte(id)
    const letzte = (sitzungen ?? []).filter((s) => s.akte_id === id).sort((a, b) => b.datum.localeCompare(a.datum))[0]
    if (letzte) setNeu((n) => ({ ...n, ausbildung: letzte.in_ausbildung }))
  }

  /** Schritt 1: Dialog „Neue Klientin / neuer Klient“ öffnen */
  function erstgespraechStarten() {
    const f = pruefeDatum(neu.datum); if (f) { setFehler(f); return }
    setFehler(''); setKlient({ vorname: '', nachname: '', notiz: '' })
  }

  /** Schritt 2: Akte mit Registereintrag anlegen und Erstgespräch öffnen (ohne Namen möglich – später im Register nachtragen) */
  async function erstgespraech(mitName: boolean) {
    const f = pruefeDatum(neu.datum); if (f) { setFehler(f); return }
    if (mitName && klient && !klient.vorname.trim() && !klient.nachname.trim()) { setFehler('Bitte Vor- und Nachnamen eingeben – oder „Ohne Namen weiter“.'); return }
    setArbeitet(true); setFehler('')
    try {
      const zusatz = mitName && klient ? { vorname: klient.vorname.trim(), nachname: klient.nachname.trim(), name: vollerName(klient.vorname, klient.nachname), notiz: klient.notiz.trim() || undefined } : {}
      const akte = await neueAkte(tresor.schluessel('zone_c'), zusatz, Number(neu.datum.slice(0, 4)))
      const s = await neueSitzung(akte.id, 'erst', { datum: neu.datum, in_ausbildung: neu.ausbildung })
      await protokolliere('akte_angelegt', akte.chiffre)
      router.push(`/protokolle/${s.id}`)
    } catch (e) { setFehler((e as Error).message); setArbeitet(false) }
  }

  async function beratungsgespraech() {
    if (!folgeAkte) { setFehler('Bitte zuerst die Chiffre wählen.'); return }
    const f = pruefeDatum(neu.datum); if (f) { setFehler(f); return }
    const erst = (sitzungen ?? []).filter((s) => s.akte_id === folgeAkte).map((s) => s.datum).sort()[0]
    if (erst && neu.datum < erst) { setFehler(`Das Datum liegt vor dem ersten Gespräch dieser Chiffre (${datum(erst)}).`); return }
    setArbeitet(true); setFehler('')
    try {
      // Akte ohne Protokolle (z. B. im Register „Nur anlegen“): das erste Gespräch ist das Erstgespräch – die Chiffre folgt seinem Jahr
      if (!erst) {
        const w = await chiffreAnJahrAnpassen(tresor.schluessel('zone_c'), folgeAkte, Number(neu.datum.slice(0, 4)))
        if (w) await protokolliere('chiffre_geaendert', `${w.alt} → ${w.neu}`)
      }
      const s = await neueSitzung(folgeAkte, erst ? 'folge' : 'erst', { datum: neu.datum, in_ausbildung: neu.ausbildung })
      router.push(`/protokolle/${s.id}`)
    } catch (e) { setFehler((e as Error).message); setArbeitet(false) }
  }

  return (
    <div className="space-y-6">
      <div><p className="overline">Dokumentation</p><h1 className="mt-2 font-heading text-heading">Protokolle</h1></div>

      <div className="karte space-y-4">
        <h2 className="font-heading text-heading">Neues Gespräch</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label>1. Datum des Gesprächs<input type="date" value={neu.datum} min={`${PROTOKOLL_AB_JAHR}-01-01`} max={`${new Date().getFullYear()}-12-31`} onChange={(e) => setNeu({ ...neu, datum: e.target.value })} /></label>
          <label className="flex items-center gap-2 pb-2.5 text-sm font-normal text-text" title="Beratung vor der Gewerbeberechtigung, z. B. als Praxisnachweis für die Ausbildung – bekommt einen Vermerk im Ausdruck und in der Nachweisliste"><input type="checkbox" checked={neu.ausbildung} onChange={(e) => setNeu({ ...neu, ausbildung: e.target.checked })} /> in Ausbildung</label>
        </div>
        <p className="text-xs text-text-subtle">Die Chiffre bekommt immer das Jahr des Erstgesprächs – Datum 2024 ergibt K-24-…. Nachträge sind ab {PROTOKOLL_AB_JAHR} möglich.</p>
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <button className="btn btn-cta" onClick={erstgespraechStarten} disabled={arbeitet}>2. + Erstgespräch (neue Klient:in)</button>
          <span className="px-2 pb-2.5 text-sm text-text-subtle">oder</span>
          <label className="min-w-44">Beratungsgespräch zu
            <select value={folgeAkte} onChange={(e) => waehleFolgeAkte(e.target.value)} className="mt-1 block w-full rounded-md border border-border-input bg-surface px-3 py-2.5 text-base">
              <option value="">Chiffre wählen …</option>
              {akten.filter((a) => a.status === 'offen').map((a) => <option key={a.id} value={a.id}>{a.chiffre}{(sitzungen ?? []).some((s) => s.akte_id === a.id) ? '' : ' (noch kein Gespräch → Erstgespräch)'}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={beratungsgespraech} disabled={arbeitet}>2. + Beratungsgespräch</button>
        </div>
      </div>
      {klient && (
        <div className="karte space-y-4 border-2 border-sage" role="dialog" aria-label="Neue Klientin / neuer Klient">
          <h2 className="font-heading text-heading">Neue Klientin / neuer Klient</h2>
          <p className="text-sm text-text-muted">Der Name steht nur verschlüsselt im Register, nie im Protokoll. Die Chiffre wird automatisch vergeben (Jahr {neu.datum.slice(0, 4)}).</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>Vorname<input autoFocus value={klient.vorname} onChange={(e) => setKlient({ ...klient, vorname: e.target.value })} autoComplete="off" /></label>
            <label>Nachname<input value={klient.nachname} onChange={(e) => setKlient({ ...klient, nachname: e.target.value })} autoComplete="off" /></label>
            <label>Hinweis (optional)<input value={klient.notiz} onChange={(e) => setKlient({ ...klient, notiz: e.target.value })} autoComplete="off" /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-cta" onClick={() => void erstgespraech(true)} disabled={arbeitet}>Anlegen und Erstgespräch beginnen</button>
            <button className="btn btn-ghost" onClick={() => void erstgespraech(false)} disabled={arbeitet}>Ohne Namen weiter</button>
            <button className="btn btn-ghost" onClick={() => setKlient(null)} disabled={arbeitet}>Abbrechen</button>
          </div>
          <p className="text-xs text-text-subtle">Kommt die Person schon wieder? Dann statt dessen „Beratungsgespräch zu“ mit ihrer Chiffre wählen.</p>
        </div>
      )}
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
                  <td className="px-4">{ART[s.art].kurz}{s.in_ausbildung && <span title="Beratung in Ausbildung" className="ml-2 whitespace-nowrap rounded-full bg-sage/30 px-2 py-0.5 text-xs text-forest-deep">Ausbildung</span>}</td>
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
