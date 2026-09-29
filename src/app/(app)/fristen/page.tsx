'use client'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bestaetigung } from '@/components/Bestaetigung'
import { akteAbschliessen, akteLoeschen, akteWiederOeffnen, fristFuerAkte, ladeLoeschprotokoll, type LoeschEintrag } from '@/lib/akten'
import { ladeFristen } from '@/lib/einstellungen'
import { datum, zeitpunkt } from '@/lib/format'
import { FRISTEN_STANDARD, type FristEinstellungen, type FristErgebnis } from '@/lib/fristen'
import { protokolliere } from '@/lib/konto'
import { ladeAkten, ladeSitzungen, type Akte, type Sitzung } from '@/lib/protokolle/daten'
import { heuteIso } from '@/lib/stammdaten'
import { useTresor } from '@/lib/tresor'

type Abschluss = { akte: Akte; datum: string; ergebnis: FristErgebnis | null; fehler: string }
type Loeschung = { akte: Akte; eingabe: string; bestaetigt: boolean }

export default function Fristen() {
  const tresor = useTresor()
  const [akten, setAkten] = useState<Akte[]>([])
  const [sitzungen, setSitzungen] = useState<Sitzung[]>([])
  const [protokoll, setProtokoll] = useState<LoeschEintrag[]>([])
  const [fristen, setFristen] = useState<FristEinstellungen>(FRISTEN_STANDARD)
  const [abschluss, setAbschluss] = useState<Abschluss | null>(null)
  const [loeschung, setLoeschung] = useState<Loeschung | null>(null)
  const [fehler, setFehler] = useState('')
  const [meldung, setMeldung] = useState('')
  const [arbeitet, setArbeitet] = useState(false)
  const heute = heuteIso()

  const laden = useCallback(async () => {
    const [a, s, p, f] = await Promise.all([ladeAkten(), ladeSitzungen(), ladeLoeschprotokoll(), ladeFristen()])
    setAkten(a); setSitzungen(s); setProtokoll(p); setFristen(f)
  }, [])
  useEffect(() => { laden().catch((e) => setFehler(e.message)) }, [laden])

  const letzte = useMemo(() => {
    const m = new Map<string, { datum: string; prozessEnde: string | null; anzahl: number }>()
    for (const s of sitzungen) {
      const x = m.get(s.akte_id) ?? { datum: '', prozessEnde: null, anzahl: 0 }
      x.anzahl++
      if (s.datum > x.datum) x.datum = s.datum
      if (s.prozess_abgeschlossen && (!x.prozessEnde || s.datum > x.prozessEnde)) x.prozessEnde = s.datum
      m.set(s.akte_id, x)
    }
    return m
  }, [sitzungen])

  const faellig = akten.filter((a) => a.status === 'abgeschlossen' && a.aufbewahrung_bis && a.aufbewahrung_bis <= heute)
  const offen = akten.filter((a) => a.status === 'offen')
  const abgeschlossen = akten.filter((a) => a.status === 'abgeschlossen' && !faellig.includes(a))

  async function vorschau(akte: Akte, d: string) {
    const basis: Abschluss = { akte, datum: d, ergebnis: null, fehler: '' }
    try { setAbschluss({ ...basis, ergebnis: await fristFuerAkte(tresor.schluessel('zone_a'), tresor.schluessel('zone_c'), akte, d, fristen) }) }
    catch (e) { setAbschluss({ ...basis, fehler: (e as Error).message }) }
  }

  async function abschliessen() {
    if (!abschluss?.ergebnis) return
    setArbeitet(true); setFehler('')
    try {
      await akteAbschliessen(abschluss.akte.id, abschluss.datum, abschluss.ergebnis.bis)
      await protokolliere('akte_abgeschlossen', abschluss.akte.chiffre)
      setMeldung(`${abschluss.akte.chiffre} abgeschlossen – aufzubewahren bis ${datum(abschluss.ergebnis.bis)}.`)
      setAbschluss(null); await laden()
    } catch (e) { setFehler((e as Error).message) } finally { setArbeitet(false) }
  }

  async function wiederOeffnen(a: Akte) {
    if (!confirm(`${a.chiffre} wieder öffnen? Die berechnete Aufbewahrungsfrist wird entfernt.`)) return
    try { await akteWiederOeffnen(a.id); await protokolliere('akte_wieder_geoeffnet', a.chiffre); await laden() } catch (e) { setFehler((e as Error).message) }
  }

  async function loeschen() {
    if (!loeschung) return
    setArbeitet(true); setFehler('')
    try {
      const u = await akteLoeschen(tresor.schluessel('zone_a'), tresor.schluessel('zone_c'), loeschung.akte)
      await protokolliere('akte_geloescht', loeschung.akte.chiffre)
      setMeldung(`${loeschung.akte.chiffre} gelöscht: ${u.sitzungen} Sitzungen, ${u.protokollfassungen} Protokollfassungen, ${u.stammdaten ? 'Stammdaten, ' : ''}${u.dokumente} Dokumente, ${u.registereintrag ? 'Registereintrag' : 'kein Registereintrag'}. Honorarnoten und Buchungen bleiben (§ 132 BAO).`)
      setLoeschung(null); await laden()
    } catch (e) { setFehler((e as Error).message) } finally { setArbeitet(false) }
  }

  const zeile = (a: Akte, aktion: React.ReactNode) => {
    const l = letzte.get(a.id)
    return (
      <tr key={a.id} className="border-t border-border">
        <td className="px-4 py-2 tabular-nums">{a.chiffre}</td>
        <td className="px-4 tabular-nums">{l ? `${l.anzahl} · zuletzt ${datum(l.datum)}` : '–'}</td>
        <td className="px-4 tabular-nums">{a.abschluss_datum ? datum(a.abschluss_datum) : l?.prozessEnde ? <span className="text-text-muted">Prozess beendet {datum(l.prozessEnde)}</span> : '–'}</td>
        <td className="px-4 tabular-nums">{a.aufbewahrung_bis ? datum(a.aufbewahrung_bis) : '–'}</td>
        <td className="whitespace-nowrap px-4 text-right">{aktion}</td>
      </tr>
    )
  }
  const tabelle = (titel: string, liste: Akte[], aktion: (a: Akte) => React.ReactNode, leer: string) => (
    <div className="karte overflow-x-auto p-0">
      <h2 className="px-4 pt-4 font-heading text-heading">{titel} <span className="text-text-subtle">({liste.length})</span></h2>
      {liste.length === 0 ? <p className="p-4 text-sm text-text-muted">{leer}</p> : (
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-widest text-text-subtle">
            {['Chiffre', 'Sitzungen', 'Abschluss', 'Aufbewahren bis', ''].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}
          </tr></thead>
          <tbody>{liste.map((a) => zeile(a, aktion(a)))}</tbody>
        </table>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="overline">Dokumentation</p>
        <h1 className="mt-2 font-heading text-heading">Fristen &amp; Löschung</h1>
        <p className="mt-2 text-sm text-text-muted">Aufbewahrung: {fristen.standard_jahre} Jahre nach Abschluss, {fristen.zustimmung_jahre} Jahre mit Zustimmung{fristen.minderjaehrige_ab_volljaehrigkeit ? `, bei Minderjährigen ab Volljährigkeit (${fristen.volljaehrig_mit})` : ''} – änderbar unter <Link href="/einstellungen">Einstellungen</Link>.</p>
      </div>
      {fehler && <p className="fehler" role="alert">{fehler}</p>}
      {meldung && <p className="hinweis text-sm">{meldung}</p>}

      {abschluss && (
        <div className="karte space-y-3 border-2 border-primary">
          <h2 className="font-heading text-heading">Akte {abschluss.akte.chiffre} abschließen</h2>
          <label className="max-w-xs">Abschlussdatum<input type="date" value={abschluss.datum} max={heute} onChange={(e) => void vorschau(abschluss.akte, e.target.value)} /></label>
          {abschluss.fehler && <p className="fehler">{abschluss.fehler}</p>}
          {abschluss.ergebnis && (
            <p>Aufzubewahren bis <b>{datum(abschluss.ergebnis.bis)}</b> – {abschluss.ergebnis.jahre} Jahre {abschluss.ergebnis.ab_volljaehrigkeit ? `ab Volljährigkeit (${datum(abschluss.ergebnis.beginn)})` : 'ab Abschluss'}{abschluss.ergebnis.grund === 'zustimmung' ? ', mit Zustimmung zur längeren Aufbewahrung' : ''}.</p>
          )}
          <p className="text-xs text-text-subtle">Der Grund (Minderjährigkeit, Zustimmung) kommt aus den verschlüsselten Stammdaten und wird nicht gespeichert – nur das Datum.</p>
          <div className="flex gap-2">
            <button className="btn btn-cta" disabled={!abschluss.ergebnis || arbeitet} onClick={() => void abschliessen()}>Abschließen</button>
            <button className="btn btn-ghost" onClick={() => setAbschluss(null)}>Abbrechen</button>
          </div>
        </div>
      )}

      {loeschung && (
        <div className="karte space-y-3 border-2 border-accent-strong" role="alertdialog" aria-label="Akte löschen">
          <h2 className="font-heading text-heading">Akte {loeschung.akte.chiffre} endgültig löschen</h2>
          <p className="text-sm">Gelöscht werden: alle Sitzungen und Protokollfassungen (Zone B), Stammdaten, Einwilligungen und Dokumente (Zone A) und der Registereintrag mit dem Namen (Zone C). Das lässt sich nicht rückgängig machen. Es bleiben die Chiffre als „gelöscht“, der Eintrag im Löschprotokoll sowie Honorarnoten und Buchungen (7 Jahre, § 132 BAO).</p>
          <label className="max-w-xs">Zur Bestätigung die Chiffre eintippen<input value={loeschung.eingabe} onChange={(e) => setLoeschung({ ...loeschung, eingabe: e.target.value })} autoComplete="off" spellCheck={false} /></label>
          {loeschung.eingabe.trim().toUpperCase() === loeschung.akte.chiffre.toUpperCase() && !loeschung.bestaetigt && (
            <Bestaetigung knopf="Löschen bestätigen" ereignis="akte_loeschen" weiter={async () => setLoeschung({ ...loeschung, bestaetigt: true })} />
          )}
          <div className="flex gap-2">
            <button className="btn btn-cta" disabled={!loeschung.bestaetigt || arbeitet} onClick={() => void loeschen()}>{arbeitet ? 'Wird gelöscht …' : 'Endgültig löschen'}</button>
            <button className="btn btn-ghost" onClick={() => setLoeschung(null)}>Abbrechen</button>
          </div>
        </div>
      )}

      {tabelle('Zur Löschung fällig', faellig, (a) => <button className="btn btn-ghost px-3 py-1 text-xs text-accent-strong" onClick={() => { setMeldung(''); setLoeschung({ akte: a, eingabe: '', bestaetigt: false }) }}>Löschen …</button>, 'Keine Akte ist zur Löschung fällig.')}
      {tabelle('Offene Akten', offen, (a) => <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => { setMeldung(''); void vorschau(a, letzte.get(a.id)?.prozessEnde ?? letzte.get(a.id)?.datum ?? heute) }}>Abschließen …</button>, 'Keine offenen Akten.')}
      {tabelle('Abgeschlossen, in Aufbewahrung', abgeschlossen, (a) => <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => void wiederOeffnen(a)}>Wieder öffnen</button>, 'Noch keine abgeschlossenen Akten.')}

      <div className="karte overflow-x-auto p-0">
        <h2 className="px-4 pt-4 font-heading text-heading">Löschprotokoll <span className="text-text-subtle">({protokoll.length})</span></h2>
        {protokoll.length === 0 ? <p className="p-4 text-sm text-text-muted">Noch keine Löschungen.</p> : (
          <table className="mt-2 w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-widest text-text-subtle">{['Chiffre', 'Abschluss', 'Frist bis', 'Gelöscht am', 'Umfang'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{protokoll.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2 tabular-nums">{p.chiffre}</td>
                <td className="px-4 tabular-nums">{p.abschluss_datum ? datum(p.abschluss_datum) : '–'}</td>
                <td className="px-4 tabular-nums">{p.aufbewahrung_bis ? datum(p.aufbewahrung_bis) : '–'}</td>
                <td className="px-4 tabular-nums">{zeitpunkt(p.geloescht_am)}</td>
                <td className="px-4 text-text-muted">{p.umfang.sitzungen ?? 0} Sitzungen, {p.umfang.protokollfassungen ?? 0} Fassungen{p.umfang.stammdaten ? ', Stammdaten' : ''}{p.umfang.registereintrag ? ', Register' : ''}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}
