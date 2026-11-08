'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { datum, heute, stunden, zahl } from '@/lib/format'
import { chiffreAnJahrAnpassen, ladeAkten, ladeAlleInhalte, ladeRegister, ladeSitzungen, neueAkte, neueSitzung, vollerName, type Akte, type Sitzung } from '@/lib/protokolle/daten'
import { ART, einordnung, einordnungsHinweis, minuten, pruefeDatum, PROTOKOLL_AB_JAHR, type Inhalt } from '@/lib/protokolle/modell'
import { ausschnitt, begriffe, trifft } from '@/lib/protokolle/suche'
import { protokolliere } from '@/lib/konto'
import { useTresor } from '@/lib/tresor'

type Spalte = 'nr' | 'datum' | 'chiffre' | 'art' | 'dauer' | 'einheiten' | 'status'
const SPALTEN: [Spalte, string][] = [['nr', 'Nr.'], ['datum', 'Datum'], ['chiffre', 'Chiffre'], ['art', 'Art'], ['dauer', 'Dauer'], ['einheiten', 'Einheiten'], ['status', 'Status']]

export default function Protokolle() {
  const router = useRouter()
  const tresor = useTresor()
  const [akten, setAkten] = useState<Akte[]>([])
  const [sitzungen, setSitzungen] = useState<Sitzung[] | null>(null)
  const [filter, setFilter] = useState({ chiffre: '', von: '', bis: '', art: '', status: '', ausbildung: '' })
  // Sortierung per Klick auf die Spaltenköpfe; gedruckt wird in dieser Reihenfolge
  const [sortierung, setSortierung] = useState<{ spalte: Spalte; auf: boolean }>({ spalte: 'datum', auf: false })
  const [folgeAkte, setFolgeAkte] = useState('')
  const [neu, setNeu] = useState({ datum: heute(), ausbildung: false })
  // Erstgespräch: zuerst Klient:in anlegen (Name nur verschlüsselt im Register)
  const [klient, setKlient] = useState<{ vorname: string; nachname: string; notiz: string } | null>(null)
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set())
  // Suche: Protokolltexte und Namen werden erst bei der ersten Suche entschlüsselt und nur im Arbeitsspeicher gehalten
  const [suche, setSuche] = useState('')
  const [inhalte, setInhalte] = useState<Map<string, Inhalt> | null>(null)
  const [namen, setNamen] = useState<Map<string, string>>(new Map())
  const [suchLaden, setSuchLaden] = useState('')
  const sb = useMemo(() => begriffe(suche), [suche])

  useEffect(() => {
    if (!sb.length || inhalte || suchLaden || !sitzungen) return
    setSuchLaden('Protokolle werden für die Suche entschlüsselt …')
    Promise.all([
      ladeAlleInhalte(tresor.schluessel('zone_b'), sitzungen, (n) => setSuchLaden(`Protokolle werden für die Suche entschlüsselt … ${n} von ${sitzungen.length}`)),
      ladeRegister(tresor.schluessel('zone_c')).catch(() => []),
    ]).then(([i, r]) => {
      setNamen(new Map(r.map((e) => [e.akte_id, [e.vorname, e.nachname, e.name, e.notiz].filter(Boolean).join(' ')])))
      setInhalte(i); setSuchLaden('')
    }).catch((e) => { setFehler((e as Error).message); setSuchLaden('') })
  }, [sb, inhalte, suchLaden, sitzungen, tresor])

  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const c = q.get('chiffre')
    if (c) setFilter((f) => ({ ...f, chiffre: c }))
    // nach einem Erstgespräch: Chiffre für das nächste Beratungsgespräch schon ausgewählt
    const folge = q.get('folge')
    if (folge) setFolgeAkte(folge)
    Promise.all([ladeAkten(), ladeSitzungen()]).then(([a, s]) => { setAkten(a); setSitzungen(s) }).catch((e) => setFehler(e.message))
  }, [])

  const chiffreVon = useMemo(() => new Map(akten.map((a) => [a.id, a.chiffre])), [akten])
  const ohneEinwilligung = useMemo(() => new Set(akten.filter((a) => a.status === 'offen' && !a.einwilligung_am).map((a) => a.id)), [akten])
  const zeilen = (sitzungen ?? []).filter((s) =>
    (!filter.chiffre || (chiffreVon.get(s.akte_id) ?? '').toLowerCase().includes(filter.chiffre.toLowerCase())) &&
    (!filter.von || s.datum >= filter.von) && (!filter.bis || s.datum <= filter.bis) &&
    (!filter.art || s.art === filter.art) && (!filter.status || s.protokoll_status === filter.status) &&
    (!filter.ausbildung || s.in_ausbildung === (filter.ausbildung === 'ja')) &&
    (!sb.length || !inhalte || trifft(suchText(s), sb)))
    .sort((x, y) => {
      const wert = (z: Sitzung): string | number => ({
        nr: z.nr, datum: z.datum, chiffre: chiffreVon.get(z.akte_id) ?? '', art: z.art,
        dauer: minuten(z.beginn, z.ende), einheiten: minuten(z.beginn, z.ende), status: z.protokoll_status,
      })[sortierung.spalte]
      const a = wert(x), b = wert(y)
      const v = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'de')
      return (sortierung.auf ? v : -v) || (sortierung.auf ? x.nr - y.nr : y.nr - x.nr)
    })
  function suchText(s: Sitzung): string {
    const felder = Object.values(inhalte?.get(s.id)?.felder ?? {}).join(' ')
    return [chiffreVon.get(s.akte_id), datum(s.datum), ART[s.art].kurz, namen.get(s.akte_id), felder].filter(Boolean).join(' ')
  }
  /** Fundstelle im Protokolltext (Name aus dem Register wird nicht angezeigt) */
  function fundstelle(s: Sitzung): { feld: string; teile: [string, string, string] } | 'register' | null {
    if (!sb.length || !inhalte) return null
    const inh = inhalte.get(s.id)
    for (const [k, titel] of ART[s.art].felder) {
      const t = inh?.felder[k]; if (!t) continue
      const a = ausschnitt(t, sb); if (a) return { feld: titel, teile: a }
    }
    return trifft(namen.get(s.akte_id) ?? '', sb) ? 'register' : null
  }
  const druckZiel = auswahl.size ? zeilen.filter((z) => auswahl.has(z.id)) : zeilen
  const drucken = (mit: 'protokolle' | 'zusammenfassung' | 'beides') => router.push(`/protokolle/druck?mit=${mit}&ids=${druckZiel.map((z) => z.id).join(',')}`)
  const sortiere = (spalte: Spalte) => setSortierung((alt) => ({ spalte, auf: alt.spalte === spalte ? !alt.auf : spalte !== 'datum' && spalte !== 'nr' }))

  /** Chiffre wählen: Häkchen „in Ausbildung“ vom letzten Protokoll dieser Chiffre übernehmen */
  function waehleFolgeAkte(id: string) {
    setFolgeAkte(id)
    const letzte = (sitzungen ?? []).filter((s) => s.akte_id === id).sort((a, b) => b.datum.localeCompare(a.datum))[0]
    if (letzte) setNeu((n) => ({ ...n, ausbildung: letzte.in_ausbildung }))
  }

  /** Hinweis mit OK/Abbrechen: schon ein Gespräch an diesem Tag? Verschieben sich Nummern (Nummern folgen dem Beratungsdatum)? */
  function einordnungBestaetigt(): boolean {
    const h = einordnungsHinweis(einordnung(sitzungen ?? [], neu.datum), datum(neu.datum))
    return !h || confirm(`${h}

OK = so anlegen · Abbrechen = anderes Datum wählen`)
  }

  /** Schritt 1: Dialog „Neue Klientin / neuer Klient“ öffnen */
  function erstgespraechStarten() {
    const f = pruefeDatum(neu.datum); if (f) { setFehler(f); return }
    if (!einordnungBestaetigt()) return
    setFehler(''); setKlient({ vorname: '', nachname: '', notiz: '' })
  }

  /** Aus der Liste: Beratungsgespräch zu dieser Chiffre vorbereiten */
  function folgeVorbereiten(akteId: string) {
    waehleFolgeAkte(akteId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    if (!einordnungBestaetigt()) return
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
          <label>Datum des Gesprächs<input type="date" value={neu.datum} min={`${PROTOKOLL_AB_JAHR}-01-01`} max={`${new Date().getFullYear()}-12-31`} onChange={(e) => setNeu({ ...neu, datum: e.target.value })} /></label>
          <label className="flex items-center gap-2 pb-2.5 text-sm font-normal text-text" title="Beratung vor der Gewerbeberechtigung, z. B. als Praxisnachweis für die Ausbildung – bekommt einen Vermerk im Ausdruck und in der Nachweisliste"><input type="checkbox" checked={neu.ausbildung} onChange={(e) => setNeu({ ...neu, ausbildung: e.target.checked })} /> in Ausbildung</label>
        </div>
        <p className="text-xs text-text-subtle">Die Chiffre bekommt immer das Jahr des Erstgesprächs – Datum 2024 ergibt K-24-…. Nachträge sind ab {PROTOKOLL_AB_JAHR} möglich. Die Protokoll-Nummern folgen dem Beratungsdatum (Nr. 1 = ältestes Gespräch).</p>
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <button className="btn btn-cta" onClick={erstgespraechStarten} disabled={arbeitet}>+ Erstgespräch (neue Klient:in)</button>
          <span className="px-2 pb-2.5 text-sm text-text-subtle">oder</span>
          <label className="min-w-44">Beratungsgespräch zu
            <select value={folgeAkte} onChange={(e) => waehleFolgeAkte(e.target.value)} className="mt-1 block w-full rounded-md border border-border-input bg-surface px-3 py-2.5 text-base">
              <option value="">Chiffre wählen …</option>
              {akten.filter((a) => a.status === 'offen').map((a) => <option key={a.id} value={a.id}>{a.chiffre}{(sitzungen ?? []).some((s) => s.akte_id === a.id) ? '' : ' (noch kein Gespräch → Erstgespräch)'}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={beratungsgespraech} disabled={arbeitet}>+ Beratungsgespräch</button>
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

      <div className="karte space-y-2 p-4">
        <label className="text-sm">Suche in Protokollen
          <input type="search" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Stichwort, Chiffre, Datum oder Name – mehrere Wörter = alle müssen vorkommen" autoComplete="off" spellCheck={false} />
        </label>
        <p className="text-xs text-text-subtle">{suchLaden || (sb.length && inhalte
          ? `${zeilen.length} Treffer. Durchsucht werden Protokolltext, Chiffre, Datum und der Name im Register. „In Anführungszeichen“ sucht einen genauen Ausdruck.`
          : 'Die Suche läuft nur hier im Browser – die Protokolle werden dafür entschlüsselt, nichts geht an den Server.')}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label>Chiffre<input value={filter.chiffre} onChange={(e) => setFilter({ ...filter, chiffre: e.target.value })} placeholder="alle" /></label>
        <label>von<input type="date" value={filter.von} onChange={(e) => setFilter({ ...filter, von: e.target.value })} /></label>
        <label>bis<input type="date" value={filter.bis} onChange={(e) => setFilter({ ...filter, bis: e.target.value })} /></label>
        <label>Art<select value={filter.art} onChange={(e) => setFilter({ ...filter, art: e.target.value })} className="mt-1 block rounded-md border border-border-input bg-surface px-3 py-2.5 text-base">
          <option value="">alle</option><option value="erst">Erstgespräch</option><option value="folge">Beratungsgespräch</option>
        </select></label>
        <label>Status<select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="mt-1 block rounded-md border border-border-input bg-surface px-3 py-2.5 text-base">
          <option value="">alle</option><option value="abgeschlossen">abgeschlossen</option><option value="entwurf">Entwurf</option>
        </select></label>
        <label>Ausbildung<select value={filter.ausbildung} onChange={(e) => setFilter({ ...filter, ausbildung: e.target.value })} className="mt-1 block rounded-md border border-border-input bg-surface px-3 py-2.5 text-base">
          <option value="">alle</option><option value="ja">in Ausbildung</option><option value="nein">ohne</option>
        </select></label>
        {(Object.values(filter).some(Boolean) || suche) && <button className="btn btn-ghost self-end" onClick={() => { setFilter({ chiffre: '', von: '', bis: '', art: '', status: '', ausbildung: '' }); setSuche('') }}>Filter zurücksetzen</button>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-muted">{auswahl.size ? `${druckZiel.length} ausgewählt` : `${zeilen.length} angezeigt`}:</span>
        <button className="btn btn-primary" disabled={!druckZiel.length} onClick={() => drucken('protokolle')}>Protokolle drucken</button>
        <button className="btn btn-ghost" disabled={!druckZiel.length} onClick={() => drucken('zusammenfassung')}>Zusammenfassung</button>
        <button className="btn btn-ghost" disabled={!druckZiel.length} onClick={() => drucken('beides')}>Zusammenfassung + Protokolle</button>
        {auswahl.size > 0 && <button className="btn btn-ghost" onClick={() => setAuswahl(new Set())}>Auswahl aufheben</button>}
      </div>
      <p className="-mt-3 text-xs text-text-subtle">Ohne Häkchen gilt alles, was nach den Filtern angezeigt wird. Gedruckt wird in der Reihenfolge der Liste – Spaltenkopf anklicken zum Sortieren.</p>

      <div className="karte overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-widest text-text-subtle">
            <th className="w-10 py-3 pl-4"><input type="checkbox" aria-label="Alle angezeigten auswählen" checked={zeilen.length > 0 && zeilen.every((z) => auswahl.has(z.id))}
              onChange={(e) => setAuswahl(e.target.checked ? new Set([...auswahl, ...zeilen.map((z) => z.id)]) : new Set([...auswahl].filter((id) => !zeilen.some((z) => z.id === id))))} /></th>
            {SPALTEN.map(([k, h], i) => (
              <th key={k} className={`px-4 py-3 font-medium ${i >= 4 && i <= 5 ? 'text-right' : ''}`} aria-sort={sortierung.spalte === k ? (sortierung.auf ? 'ascending' : 'descending') : 'none'}>
                <button type="button" className="uppercase tracking-widest hover:text-heading" onClick={() => sortiere(k)}>{h}{sortierung.spalte === k ? (sortierung.auf ? ' ▲' : ' ▼') : ''}</button>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {zeilen.map((s) => {
              const m = minuten(s.beginn, s.ende)
              const fund = fundstelle(s)
              return (
                <Fragment key={s.id}>
                <tr className={`border-t border-border hover:bg-background ${auswahl.has(s.id) ? 'bg-background' : ''}`}>
                  <td className="py-3 pl-4"><input type="checkbox" aria-label={`Protokoll Nr. ${s.nr} auswählen`} checked={auswahl.has(s.id)}
                    onChange={(e) => { const n = new Set(auswahl); if (e.target.checked) n.add(s.id); else n.delete(s.id); setAuswahl(n) }} /></td>
                  <td className="px-4 py-3 tabular-nums"><Link href={`/protokolle/${s.id}`} className="no-underline">{s.nr}</Link></td>
                  <td className="px-4 tabular-nums"><Link href={`/protokolle/${s.id}`} className="no-underline">{datum(s.datum)}</Link></td>
                  <td className="px-4 tabular-nums"><span className="whitespace-nowrap">{chiffreVon.get(s.akte_id)}{akten.find((a) => a.id === s.akte_id)?.status === 'offen' && <button type="button" className="ml-1.5 rounded-full border border-border-input px-1.5 text-xs text-text-muted hover:bg-sand" title="Beratungsgespräch zu dieser Chiffre anlegen" aria-label={`Beratungsgespräch zu ${chiffreVon.get(s.akte_id)} anlegen`} onClick={() => folgeVorbereiten(s.akte_id)}>+ Beratung</button>}</span>{ohneEinwilligung.has(s.akte_id) && <span title="Einwilligung (Art. 9 DSGVO) noch nicht erfasst – im Register unter „Stammdaten“" className="ml-2 whitespace-nowrap rounded-full bg-sand px-2 py-0.5 text-xs">Einwilligung fehlt</span>}</td>
                  <td className="px-4">{ART[s.art].kurz}{s.in_ausbildung && <span title="Beratung in Ausbildung" className="ml-2 whitespace-nowrap rounded-full bg-sage/30 px-2 py-0.5 text-xs text-forest-deep">Ausbildung</span>}</td>
                  <td className="px-4 text-right tabular-nums">{m ? `${stunden(m)} h` : '–'}</td>
                  <td className="px-4 text-right tabular-nums">{m ? zahl(s.arbeitseinheiten ?? 0) : '–'}</td>
                  <td className="px-4">{s.protokoll_status === 'abgeschlossen'
                    ? <span className="rounded-full bg-sage/30 px-2 py-0.5 text-xs text-forest-deep">abgeschlossen</span>
                    : <span className="rounded-full bg-sand px-2 py-0.5 text-xs">Entwurf</span>}</td>
                </tr>
                {fund && (
                  <tr className={auswahl.has(s.id) ? 'bg-background' : ''}>
                    <td />
                    <td colSpan={SPALTEN.length} className="px-4 pb-3 text-xs text-text-muted">
                      {fund === 'register' ? 'Treffer beim Namen im Register'
                        : <><span className="text-text-subtle">{fund.feld}: </span>{fund.teile[0]}<mark className="rounded bg-sand px-0.5 text-text">{fund.teile[1]}</mark>{fund.teile[2]}</>}
                    </td>
                  </tr>
                )}
                </Fragment>
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
