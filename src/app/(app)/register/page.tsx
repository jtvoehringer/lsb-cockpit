'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AuskunftAnsicht } from '@/components/AuskunftAnsicht'
import { StammdatenPanel } from '@/components/StammdatenPanel'
import { TeilnahmeAnsicht } from '@/components/TeilnahmeAnsicht'
import { datum, heute } from '@/lib/format'
import { akteZuordnen, leereAkteEntfernen } from '@/lib/akten'
import { protokolliere } from '@/lib/konto'
import { zeigeMeldung } from '@/lib/meldung'
import { aktualisiereRegister, ladeAkten, ladeRegister, ladeSitzungen, neueAkte, neueSitzung, registerNamenMigrieren, vollerName, type Akte, type RegisterInhalt } from '@/lib/protokolle/daten'
import { pruefeDatum, PROTOKOLL_AB_JAHR } from '@/lib/protokolle/modell'
import { useTresor } from '@/lib/tresor'

// Register (Zone C): Chiffre ↔ Person, verschlüsselt mit K_C. Seit 02.10.2026 ohne zusätzliche Bestätigung (Wunsch der Beraterin:
// eine Person, Anmeldung mit 2FA + Passkey genügt). Namen erscheinen weiterhin nie in Listen der Dokumentation (Zone B).
type Zeile = RegisterInhalt & { id: string; akte?: Akte; letzteSitzung?: string }

export default function Register() {
  const tresor = useTresor()
  const router = useRouter()
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [zeilen, setZeilen] = useState<Zeile[]>([])
  const [suche, setSuche] = useState('')
  const [bearbeiten, setBearbeiten] = useState<Zeile | null>(null)
  const [stamm, setStamm] = useState<Zeile | null>(null)
  const [auskunft, setAuskunft] = useState<string | null>(null)
  const [teilnahme, setTeilnahme] = useState<Zeile | null>(null)
  const [zuordnen, setZuordnen] = useState<{ quelle: Zeile; ziel: string } | null>(null)
  const LEER_NEU = { vorname: '', nachname: '', notiz: '', datum: heute(), ausbildung: false }
  const [neu, setNeu] = useState(LEER_NEU)
  useEffect(() => { laden().catch((e) => setFehler((e as Error).message)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function laden() {
    // Einmalig: bisheriges Feld „Name“ in Vorname/Nachname teilen (nur im Browser möglich – verschlüsselt)
    const umgestellt = await registerNamenMigrieren(tresor.schluessel('zone_c'))
    if (umgestellt) { await protokolliere('register_namen_geteilt', `${umgestellt} Einträge`); zeigeMeldung(`${umgestellt} Namen in Vorname und Nachname aufgeteilt – bitte kurz prüfen.`) }
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
      await aktualisiereRegister(tresor.schluessel('zone_c'), id, { ...inhalt, vorname: inhalt.vorname?.trim() ?? '', nachname: inhalt.nachname?.trim() ?? '', name: vollerName(inhalt.vorname, inhalt.nachname) || undefined })
      await protokolliere('register_geaendert', z.chiffre)
      setBearbeiten(null); zeigeMeldung(`${z.chiffre} gespeichert.`); await laden()
    } catch (err) { setFehler((err as Error).message) }
  }

  /** Leere Akte (ohne Gespräche) löschen */
  async function loeschen(z: Zeile) {
    if (!confirm(`${z.chiffre}${z.name ? ` (${z.name})` : ''} endgültig löschen? Name, Hinweis und Stammdaten dieser Chiffre werden entfernt.`)) return
    setFehler('')
    try {
      await leereAkteEntfernen(tresor.schluessel('zone_a'), tresor.schluessel('zone_c'), z.akte_id)
      await protokolliere('akte_entfernt', z.chiffre)
      zeigeMeldung(`${z.chiffre} gelöscht.`); await laden()
    } catch (err) { setFehler((err as Error).message) }
  }

  /** Klient:in ohne Gespräche mit einer Chiffre verknüpfen, unter der schon Protokolle stehen */
  async function verknuepfen() {
    if (!zuordnen?.ziel) { setFehler('Bitte die Chiffre mit den Protokollen wählen.'); return }
    const ziel = zeilen.find((x) => x.akte_id === zuordnen.ziel)!
    const q = zuordnen.quelle
    if (ziel.name && q.name && ziel.name !== q.name && !confirm(`Unter ${ziel.chiffre} steht schon der Name „${ziel.name}“. Durch „${q.name}“ ersetzen?`)) return
    setFehler('')
    try {
      await akteZuordnen(tresor.schluessel('zone_c'), q.akte_id, ziel.akte_id)
      await protokolliere('akte_zugeordnet', `${q.chiffre} → ${ziel.chiffre}`)
      setZuordnen(null); zeigeMeldung(`${q.chiffre} ist jetzt mit ${ziel.chiffre} verknüpft und wurde entfernt.`); await laden()
    } catch (err) { setFehler((err as Error).message) }
  }

  async function anlegen(mitErstgespraech: boolean) {
    if (!neu.vorname.trim() && !neu.nachname.trim()) { setFehler('Bitte Vor- und Nachnamen eingeben.'); return }
    const f = pruefeDatum(neu.datum); if (f) { setFehler(f); return }
    setFehler(''); setArbeitet(true)
    try {
      const akte = await neueAkte(tresor.schluessel('zone_c'), { vorname: neu.vorname.trim(), nachname: neu.nachname.trim(), name: vollerName(neu.vorname, neu.nachname), notiz: neu.notiz.trim() || undefined }, Number(neu.datum.slice(0, 4)))
      await protokolliere('akte_angelegt', akte.chiffre)
      if (!mitErstgespraech) zeigeMeldung(`${akte.chiffre} angelegt.`)
      setNeu(LEER_NEU)
      if (mitErstgespraech) { const s = await neueSitzung(akte.id, 'erst', { datum: neu.datum, in_ausbildung: neu.ausbildung }); router.push(`/protokolle/${s.id}`); return }
      await laden()
    } catch (err) { setFehler((err as Error).message) } finally { setArbeitet(false) }
  }

  if (auskunft) return <AuskunftAnsicht akteId={auskunft} schliessen={() => setAuskunft(null)} />
  if (teilnahme) return <TeilnahmeAnsicht akteId={teilnahme.akte_id} name={teilnahme.name ?? ''} chiffre={teilnahme.chiffre} schliessen={() => setTeilnahme(null)} />

  const q = suche.trim().toLowerCase()
  const gefiltert = zeilen.filter((z) => !q || [z.chiffre, z.name, z.vorname, z.nachname, z.kuerzel_alt, z.notiz].some((w) => w?.toLowerCase().includes(q)))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="overline">Register</p><h1 className="mt-2 font-heading text-heading">Chiffren und Personen</h1></div>
      </div>
      {fehler && <p className="fehler" role="alert">{fehler}</p>}

      <div className="karte space-y-3">
        <h2 className="font-heading text-heading">Neue Klientin / neuer Klient</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Vorname<input value={neu.vorname} onChange={(e) => setNeu({ ...neu, vorname: e.target.value })} autoComplete="off" /></label>
          <label>Nachname<input value={neu.nachname} onChange={(e) => setNeu({ ...neu, nachname: e.target.value })} autoComplete="off" /></label>
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

      <ul className="karte divide-y divide-border p-0">
        {gefiltert.map((z) => {
          const ohneGespraech = !z.letzteSitzung
          if (bearbeiten?.id === z.id) return (
            <li key={z.id} className="space-y-3 bg-background px-4 py-4">
              <p className="font-semibold tabular-nums">{z.chiffre}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>Vorname<input value={bearbeiten.vorname ?? ''} onChange={(e) => setBearbeiten({ ...bearbeiten, vorname: e.target.value })} autoComplete="off" /></label>
                <label>Nachname<input value={bearbeiten.nachname ?? ''} onChange={(e) => setBearbeiten({ ...bearbeiten, nachname: e.target.value })} autoComplete="off" /></label>
                <label>Hinweis<input value={bearbeiten.notiz ?? ''} onChange={(e) => setBearbeiten({ ...bearbeiten, notiz: e.target.value })} autoComplete="off" /></label>
                <label className="sm:col-span-2">Adresse für Honorarnoten (optional)<textarea rows={2} value={bearbeiten.adresse ?? ''} onChange={(e) => setBearbeiten({ ...bearbeiten, adresse: e.target.value })} className="mt-1 block w-full rounded-md border border-border-input bg-surface p-2 text-base" /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-cta" onClick={() => void speichern(bearbeiten)}>Speichern</button>
                <button className="btn btn-ghost" onClick={() => setBearbeiten(null)}>Abbrechen</button>
              </div>
            </li>
          )
          return (
            <li key={z.id} className="px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p><span className="font-semibold tabular-nums">{z.chiffre}</span> · {z.nachname || z.vorname ? <><b className="font-semibold">{z.nachname}</b>{z.vorname && `, ${z.vorname}`}</> : z.name || <span className="text-text-subtle">noch kein Name</span>}
                  {(z.notiz || z.kuerzel_alt) && <span className="text-text-muted"> · {[z.notiz, z.kuerzel_alt && `altes Kürzel ${z.kuerzel_alt}`].filter(Boolean).join(' · ')}</span>}</p>
                <p className="text-sm text-text-muted">Einwilligung {z.akte?.einwilligung_am ? datum(z.akte.einwilligung_am) : <span className="font-medium text-accent-strong">fehlt</span>} · {ohneGespraech ? 'noch kein Gespräch' : `letztes Gespräch ${datum(z.letzteSitzung!)}`}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn btn-ghost px-3 py-1 text-sm" onClick={() => { setZuordnen(null); setBearbeiten(z) }}>{z.name ? 'Bearbeiten' : 'Name eintragen'}</button>
                <button className="btn btn-ghost px-3 py-1 text-sm" onClick={() => { setStamm(z); scrollTo({ top: 0, behavior: 'smooth' }) }}>Stammdaten</button>
                {!ohneGespraech && <Link className="btn btn-ghost px-3 py-1 text-sm no-underline" href={`/protokolle?chiffre=${encodeURIComponent(z.chiffre)}`}>Protokolle</Link>}
                <button className="btn btn-ghost px-3 py-1 text-sm" onClick={() => setAuskunft(z.akte_id)}>Auskunft</button>
                {!ohneGespraech && <button className="btn btn-ghost px-3 py-1 text-sm" onClick={() => setTeilnahme(z)}>Bestätigung</button>}
                {ohneGespraech && <button className="btn btn-ghost px-3 py-1 text-sm" onClick={() => { setBearbeiten(null); setZuordnen({ quelle: z, ziel: '' }) }}>Mit Protokollen verknüpfen …</button>}
                {ohneGespraech && z.akte?.status === 'offen' && <button className="btn btn-ghost px-3 py-1 text-sm text-accent-strong" onClick={() => void loeschen(z)}>Löschen</button>}
              </div>
              {zuordnen?.quelle.id === z.id && (
                <div className="mt-3 space-y-3 rounded-md bg-background p-3">
                  <p className="text-sm">Unter welcher Chiffre stehen die Protokolle von {z.name || z.chiffre}? Name, Hinweis, Adresse und Stammdaten gehen auf diese Chiffre über, {z.chiffre} wird danach gelöscht.</p>
                  <label className="max-w-sm">Chiffre mit Protokollen
                    <select value={zuordnen.ziel} onChange={(e) => setZuordnen({ ...zuordnen, ziel: e.target.value })} className="mt-1 block w-full rounded-md border border-border-input bg-surface px-3 py-2.5 text-base">
                      <option value="">bitte wählen …</option>
                      {zeilen.filter((x) => x.letzteSitzung && x.akte?.status === 'offen').sort((x, y) => Number(!!x.name) - Number(!!y.name)).map((x) => <option key={x.id} value={x.akte_id}>{x.chiffre} · {x.name || 'ohne Name'} · letztes Gespräch {datum(x.letzteSitzung!)}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-cta" onClick={() => void verknuepfen()}>Verknüpfen</button>
                    <button className="btn btn-ghost" onClick={() => setZuordnen(null)}>Abbrechen</button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
        {gefiltert.length === 0 && <li className="p-6 text-text-muted">{zeilen.length ? 'Keine Treffer.' : 'Noch keine Einträge.'}</li>}
      </ul>
    </div>
  )
}
