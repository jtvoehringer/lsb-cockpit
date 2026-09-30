'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bestaetigung } from '@/components/Bestaetigung'
import { AuskunftAnsicht } from '@/components/AuskunftAnsicht'
import { StammdatenPanel } from '@/components/StammdatenPanel'
import { TeilnahmeAnsicht } from '@/components/TeilnahmeAnsicht'
import { datum, heute } from '@/lib/format'
import { protokolliere } from '@/lib/konto'
import { aktualisiereRegister, ladeAkten, ladeRegister, ladeSitzungen, neueAkte, neueSitzung, type Akte, type RegisterInhalt } from '@/lib/protokolle/daten'
import { pruefeDatum, PROTOKOLL_AB_JAHR } from '@/lib/protokolle/modell'
import { useTresor } from '@/lib/tresor'

// Register (Zone C): Chiffre ↔ Person. Anzeige erst nach erneuter Bestätigung – Passkey oder Passphrase (E-04), Sperre nach 5 Minuten.
// Namen erscheinen nie in Listen der Dokumentation (Zone B).
const REGISTER_SPERRE_MIN = 5
type Zeile = RegisterInhalt & { id: string; akte?: Akte; letzteSitzung?: string }

export default function Register() {
  const tresor = useTresor()
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [zeilen, setZeilen] = useState<Zeile[]>([])
  const [suche, setSuche] = useState('')
  const [bearbeiten, setBearbeiten] = useState<Zeile | null>(null)
  const [stamm, setStamm] = useState<Zeile | null>(null)
  const [auskunft, setAuskunft] = useState<string | null>(null)
  const [teilnahme, setTeilnahme] = useState<Zeile | null>(null)
  const [neu, setNeu] = useState({ name: '', notiz: '', datum: heute(), ausbildung: false })
  const aktivitaet = useRef(Date.now())

  const sperren = useCallback(() => { setOffen(false); setZeilen([]); setBearbeiten(null); setStamm(null); setSuche('') }, [])

  // Nach 5 Minuten ohne Eingabe wieder sperren
  useEffect(() => {
    if (!offen) return
    const aktiv = () => { aktivitaet.current = Date.now() }
    addEventListener('pointerdown', aktiv); addEventListener('keydown', aktiv)
    const t = setInterval(() => { if (Date.now() - aktivitaet.current > REGISTER_SPERRE_MIN * 60_000) sperren() }, 10_000)
    return () => { clearInterval(t); removeEventListener('pointerdown', aktiv); removeEventListener('keydown', aktiv) }
  }, [offen, sperren])

  async function laden() {
    const [reg, akten, sitzungen] = await Promise.all([ladeRegister(tresor.schluessel('zone_c')), ladeAkten(), ladeSitzungen()])
    const akteVon = new Map(akten.map((a) => [a.id, a]))
    const letzte = new Map<string, string>()
    for (const s of sitzungen) if (!letzte.has(s.akte_id) || letzte.get(s.akte_id)! < s.datum) letzte.set(s.akte_id, s.datum)
    setZeilen(reg.map((r) => ({ ...r, akte: akteVon.get(r.akte_id), letzteSitzung: letzte.get(r.akte_id) })).sort((a, b) => (b.akte?.erstellt_am ?? '').localeCompare(a.akte?.erstellt_am ?? '')))
  }

  async function speichern(z: Zeile) {
    setFehler('')
    try {
      const { id, akte: _a, letzteSitzung: _l, ...inhalt } = z
      await aktualisiereRegister(tresor.schluessel('zone_c'), id, inhalt)
      await protokolliere('register_geaendert', z.chiffre)
      setBearbeiten(null); await laden()
    } catch (err) { setFehler((err as Error).message) }
  }

  async function anlegen(mitErstgespraech: boolean) {
    if (!neu.name.trim()) { setFehler('Bitte einen Namen eingeben.'); return }
    const f = pruefeDatum(neu.datum); if (f) { setFehler(f); return }
    setFehler(''); setArbeitet(true)
    try {
      const akte = await neueAkte(tresor.schluessel('zone_c'), { name: neu.name.trim(), notiz: neu.notiz.trim() || undefined }, Number(neu.datum.slice(0, 4)))
      await protokolliere('akte_angelegt', akte.chiffre)
      setNeu({ name: '', notiz: '', datum: heute(), ausbildung: false })
      if (mitErstgespraech) { const s = await neueSitzung(akte.id, 'erst', { datum: neu.datum, in_ausbildung: neu.ausbildung }); router.push(`/protokolle/${s.id}`); return }
      await laden()
    } catch (err) { setFehler((err as Error).message) } finally { setArbeitet(false) }
  }

  if (!offen) return (
    <div className="max-w-md space-y-6">
      <div><p className="overline">Register</p><h1 className="mt-2 font-heading text-heading">Chiffren und Personen</h1></div>
      <div className="karte space-y-4">
        <p>Das Register verbindet Chiffren mit Namen. Es ist zusätzlich geschützt: bitte noch einmal bestätigen. Nach {REGISTER_SPERRE_MIN} Minuten ohne Eingabe sperrt es sich wieder.</p>
        <Bestaetigung knopf="Register öffnen" ereignis="register_geoeffnet" autoFocus weiter={async (_t, mittel) => {
          aktivitaet.current = Date.now()
          await laden(); setOffen(true)
          await protokolliere('register_geoeffnet', { passkey: 'Passkey', passphrase: 'Passphrase', notfall: 'Notfallblatt' }[mittel])
        }} />
      </div>
    </div>
  )

  if (auskunft) return <AuskunftAnsicht akteId={auskunft} schliessen={() => setAuskunft(null)} />
  if (teilnahme) return <TeilnahmeAnsicht akteId={teilnahme.akte_id} name={teilnahme.name ?? ''} chiffre={teilnahme.chiffre} schliessen={() => setTeilnahme(null)} />

  const q = suche.trim().toLowerCase()
  const gefiltert = zeilen.filter((z) => !q || [z.chiffre, z.name, z.kuerzel_alt, z.notiz].some((w) => w?.toLowerCase().includes(q)))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="overline">Register · geöffnet</p><h1 className="mt-2 font-heading text-heading">Chiffren und Personen</h1></div>
        <button className="btn btn-ghost" onClick={() => { void protokolliere('register_gesperrt'); sperren() }}>Register sperren</button>
      </div>
      {fehler && <p className="fehler" role="alert">{fehler}</p>}

      <div className="karte space-y-3">
        <h2 className="font-heading text-heading">Neue Klientin / neuer Klient</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Name<input value={neu.name} onChange={(e) => setNeu({ ...neu, name: e.target.value })} autoComplete="off" /></label>
          <label>Hinweis (optional)<input value={neu.notiz} onChange={(e) => setNeu({ ...neu, notiz: e.target.value })} autoComplete="off" /></label>
          <label>Erstgespräch am<input type="date" value={neu.datum} min={`${PROTOKOLL_AB_JAHR}-01-01`} max={`${new Date().getFullYear()}-12-31`} onChange={(e) => setNeu({ ...neu, datum: e.target.value })} /></label>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-normal text-text"><input type="checkbox" checked={neu.ausbildung} onChange={(e) => setNeu({ ...neu, ausbildung: e.target.checked })} /> in Ausbildung (Vermerk im Protokoll)</label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-cta" disabled={arbeitet} onClick={() => void anlegen(true)}>Anlegen und Erstgespräch beginnen</button>
          <button className="btn btn-ghost" disabled={arbeitet} onClick={() => void anlegen(false)}>Nur anlegen</button>
        </div>
        <p className="text-xs text-text-subtle">Die Chiffre wird automatisch vergeben (mit dem Jahr des Erstgesprächs – auch für Nachträge ab {PROTOKOLL_AB_JAHR}). Der Name steht nur verschlüsselt im Register.</p>
      </div>

      {stamm && <StammdatenPanel key={stamm.id} zeile={stamm} schliessen={() => setStamm(null)} gespeichert={laden} />}

      <label className="max-w-sm">Suche (Name, Chiffre, Hinweis)<input value={suche} onChange={(e) => setSuche(e.target.value)} autoComplete="off" /></label>

      <div className="karte overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-widest text-text-subtle">
            {['Chiffre', 'Name', 'Hinweis / Adresse', 'Einwilligung', 'Letzte Sitzung', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
          </tr></thead>
          <tbody>
            {gefiltert.map((z) => bearbeiten?.id === z.id ? (
              <tr key={z.id} className="border-t border-border bg-background">
                <td className="px-4 py-2 tabular-nums">{z.chiffre}</td>
                <td className="px-2"><input aria-label="Name" value={bearbeiten.name ?? ''} onChange={(e) => setBearbeiten({ ...bearbeiten, name: e.target.value })} /></td>
                <td className="px-2"><input aria-label="Hinweis" value={bearbeiten.notiz ?? ''} onChange={(e) => setBearbeiten({ ...bearbeiten, notiz: e.target.value })} />
                  <textarea aria-label="Adresse für Honorarnoten" placeholder="Adresse für Honorarnoten (optional)" rows={2} value={bearbeiten.adresse ?? ''} onChange={(e) => setBearbeiten({ ...bearbeiten, adresse: e.target.value })} className="mt-1 block w-full rounded-md border border-border-input bg-surface p-2 text-sm" /></td>
                <td className="px-4" />
                <td className="px-4 tabular-nums">{z.letzteSitzung ? datum(z.letzteSitzung) : '–'}</td>
                <td className="whitespace-nowrap px-4"><button className="btn btn-cta px-3 py-1 text-xs" onClick={() => void speichern(bearbeiten)}>Speichern</button> <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => setBearbeiten(null)}>Abbrechen</button></td>
              </tr>
            ) : (
              <tr key={z.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{z.chiffre}</td>
                <td className="px-4">{z.name || <span className="text-text-subtle">– noch kein Name –</span>}</td>
                <td className="px-4 text-text-muted">{[z.notiz, z.kuerzel_alt && `altes Kürzel ${z.kuerzel_alt}`].filter(Boolean).join(' · ')}</td>
                <td className="px-4 tabular-nums">{z.akte?.einwilligung_am ? datum(z.akte.einwilligung_am) : <span className="font-medium text-accent-strong">fehlt</span>}</td>
                <td className="px-4 tabular-nums">{z.letzteSitzung ? datum(z.letzteSitzung) : '–'}</td>
                <td className="whitespace-nowrap px-4"><button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => setBearbeiten(z)}>Bearbeiten</button> <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => { setStamm(z); scrollTo({ top: 0, behavior: 'smooth' }) }}>Stammdaten</button> <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => setAuskunft(z.akte_id)}>Auskunft</button> <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => setTeilnahme(z)}>Bestätigung</button> <Link className="text-xs" href={`/protokolle?chiffre=${encodeURIComponent(z.chiffre)}`}>Protokolle</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {gefiltert.length === 0 && <p className="p-6 text-text-muted">{zeilen.length ? 'Keine Treffer.' : 'Noch keine Einträge.'}</p>}
      </div>
    </div>
  )
}
