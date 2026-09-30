'use client'
import { useEffect, useMemo, useState } from 'react'
import brand from '@/config/brand.config'
import { datum, heute, stunden, zahl } from '@/lib/format'
import { ladeAkten, ladeSitzungen, type Akte, type Sitzung } from '@/lib/protokolle/daten'
import { ART, einheiten, minuten } from '@/lib/protokolle/modell'

type Ausbildung = 'alle' | 'nur' | 'ohne'
const AUSBILDUNG_TITEL: Record<Ausbildung, string> = { alle: 'alle Protokolle', nur: 'nur in Ausbildung', ohne: 'ohne Ausbildung' }

// Nachweisliste (z. B. für den Befähigungsnachweis): nur pseudonyme Metadaten – keine Namen, keine Inhalte.
export default function Nachweis() {
  const [akten, setAkten] = useState<Akte[]>([])
  const [sitzungen, setSitzungen] = useState<Sitzung[]>([])
  const [von, setVon] = useState('')
  const [bis, setBis] = useState('')
  const [nurAbgeschlossen, setNurAbgeschlossen] = useState(true)
  const [ausbildung, setAusbildung] = useState<Ausbildung>('alle')
  const [fehler, setFehler] = useState('')

  useEffect(() => { Promise.all([ladeAkten(), ladeSitzungen()]).then(([a, s]) => { setAkten(a); setSitzungen(s) }).catch((e) => setFehler(e.message)) }, [])

  const chiffreVon = useMemo(() => new Map(akten.map((a) => [a.id, a.chiffre])), [akten])
  const zeilen = sitzungen
    .filter((s) => (!nurAbgeschlossen || s.protokoll_status === 'abgeschlossen') && (ausbildung === 'alle' || s.in_ausbildung === (ausbildung === 'nur')) && (!von || s.datum >= von) && (!bis || s.datum <= bis))
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.nr - b.nr)
  const min = zeilen.reduce((x, s) => x + minuten(s.beginn, s.ende), 0)
  const vn = zeilen.reduce((x, s) => x + s.vorbereitung_min + s.nachbereitung_min, 0)
  const summen = [
    [String(zeilen.length), 'Protokolle'], [zahl(einheiten(min)), 'Einheiten (50 Min.)'], [stunden(min), 'Beratungsstunden'],
    [String(zeilen.filter((s) => s.art === 'erst').length), 'Erstgespräche'],
    [String(new Set(zeilen.filter((s) => s.prozess_abgeschlossen).map((s) => s.akte_id)).size), 'abgeschlossene Prozesse'],
    [String(new Set(zeilen.map((s) => s.akte_id)).size), 'Klient:innen (Chiffren)'], [stunden(vn), 'Vor-/Nachbereitung (Std.)'],
    [String(zeilen.filter((s) => s.in_ausbildung).length), 'davon in Ausbildung'],
  ]

  function csv() {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`
    const kopf = ['Nr', 'Datum', 'Chiffre', 'Art', 'Beginn', 'Ende', 'Dauer_Std', 'Einheiten_50min', 'Vorbereitung_Min', 'Nachbereitung_Min', 'Prozess_abgeschlossen', 'In_Ausbildung', 'Status']
    const daten = zeilen.map((s) => { const m = minuten(s.beginn, s.ende); return [s.nr, datum(s.datum), q(chiffreVon.get(s.akte_id) ?? ''), ART[s.art].kurz, s.beginn ?? '', s.ende ?? '', stunden(m), zahl(einheiten(m)), s.vorbereitung_min, s.nachbereitung_min, s.prozess_abgeschlossen ? 'ja' : 'nein', s.in_ausbildung ? 'ja' : 'nein', s.protokoll_status].join(';') })
    const url = URL.createObjectURL(new Blob(['﻿' + [kopf.join(';'), ...daten].join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `nachweisliste-${heute()}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  return (
    <div className="space-y-6">
      <div className="nicht-drucken flex flex-wrap items-end justify-between gap-3">
        <div><p className="overline">Auswertung</p><h1 className="mt-2 font-heading text-heading">Nachweisliste</h1></div>
        <div className="flex gap-2"><button className="btn btn-ghost" onClick={csv}>CSV</button><button className="btn btn-primary" onClick={() => print()}>Drucken / PDF</button></div>
      </div>
      <div className="nur-druck">
        <div className="flex items-start justify-between border-b border-border pb-2 text-xs text-text-muted"><span>{brand.appName}</span><img src="/brand/bildmarke.svg" alt="" width={36} height={27} /></div>
        <h1 className="mt-3 font-heading text-2xl text-heading">Nachweisliste Beratungseinheiten</h1>
        <p className="text-xs">Zeitraum: {von ? datum(von) : 'Beginn'} bis {bis ? datum(bis) : datum(heute())} · {AUSBILDUNG_TITEL[ausbildung]} · Einheit = 50 Minuten · nur Chiffren, keine Namen</p>
        {zeilen.some((s) => s.in_ausbildung) && <p className="text-xs">„(A)“ = Beratung im Rahmen der Ausbildung zur Lebens- und Sozialberaterin (vor Erteilung der Gewerbeberechtigung)</p>}
      </div>
      {fehler && <p className="fehler">{fehler}</p>}
      <div className="nicht-drucken flex flex-wrap items-end gap-3">
        <label>von<input type="date" value={von} onChange={(e) => setVon(e.target.value)} /></label>
        <label>bis<input type="date" value={bis} onChange={(e) => setBis(e.target.value)} /></label>
        <label className="flex items-center gap-2 pb-2 text-sm font-normal text-text"><input type="checkbox" checked={nurAbgeschlossen} onChange={(e) => setNurAbgeschlossen(e.target.checked)} /> nur abgeschlossene Protokolle</label>
        <label>Ausbildung<select value={ausbildung} onChange={(e) => setAusbildung(e.target.value as Ausbildung)} className="mt-1 block rounded-md border border-border-input bg-surface px-3 py-2.5 text-base">
          {(Object.keys(AUSBILDUNG_TITEL) as Ausbildung[]).map((k) => <option key={k} value={k}>{AUSBILDUNG_TITEL[k]}</option>)}
        </select></label>
      </div>
      <div className="druck-summen grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {summen.map(([w, t]) => <div key={t} className="karte p-4"><b className="block font-heading text-2xl font-normal tabular-nums text-heading">{w}</b><span className="text-xs text-text-subtle">{t}</span></div>)}
      </div>
      <div className="karte overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-widest text-text-subtle">
            {['Nr.', 'Datum', 'Chiffre', 'Art', 'Dauer (Std.)', 'Einheiten', 'Vor-/Nachb. (Std.)'].map((h, i) => <th key={h} className={`whitespace-nowrap px-4 py-3 font-medium ${i >= 4 ? 'text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody>{zeilen.map((s) => { const m = minuten(s.beginn, s.ende); return (
            <tr key={s.id} className="border-t border-border"><td className="px-4 py-2 tabular-nums">{s.nr}</td><td className="px-4 tabular-nums">{datum(s.datum)}</td><td className="whitespace-nowrap px-4 tabular-nums">{chiffreVon.get(s.akte_id)}</td><td className="px-4">{ART[s.art].kurz}{s.in_ausbildung && <b title="in Ausbildung" className="ml-1">(A)</b>}</td>
              <td className="px-4 text-right tabular-nums">{stunden(m)}</td><td className="px-4 text-right tabular-nums">{zahl(einheiten(m))}</td><td className="px-4 text-right tabular-nums">{stunden(s.vorbereitung_min + s.nachbereitung_min)}</td></tr>) })}</tbody>
        </table>
      </div>
      <div className="nur-druck mt-12 flex gap-10 text-xs text-text-muted"><div className="flex-1 border-t border-taupe pt-1">Datum, Unterschrift Beraterin</div><div className="flex-1 border-t border-taupe pt-1">Bestätigung (optional)</div></div>
    </div>
  )
}
