'use client'
import { useEffect, useMemo, useState } from 'react'
import { NachweisDruck } from '@/components/NachweisDruck'
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
      {fehler && <p className="fehler">{fehler}</p>}
      <div className="nicht-drucken flex flex-wrap items-end gap-3">
        <label>von<input type="date" value={von} onChange={(e) => setVon(e.target.value)} /></label>
        <label>bis<input type="date" value={bis} onChange={(e) => setBis(e.target.value)} /></label>
        <label className="flex items-center gap-2 pb-2 text-sm font-normal text-text"><input type="checkbox" checked={nurAbgeschlossen} onChange={(e) => setNurAbgeschlossen(e.target.checked)} /> nur abgeschlossene Protokolle</label>
        <label>Ausbildung<select value={ausbildung} onChange={(e) => setAusbildung(e.target.value as Ausbildung)} className="mt-1 block rounded-md border border-border-input bg-surface px-3 py-2.5 text-base">
          {(Object.keys(AUSBILDUNG_TITEL) as Ausbildung[]).map((k) => <option key={k} value={k}>{AUSBILDUNG_TITEL[k]}</option>)}
        </select></label>
      </div>
      <NachweisDruck zeilen={zeilen} chiffreVon={chiffreVon} von={von} bis={bis} auswahl={AUSBILDUNG_TITEL[ausbildung]} />
    </div>
  )
}
