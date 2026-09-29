'use client'
// Teilnahmebestätigung einer Person (nur Termine und Einheiten, keine Inhalte) – aus dem Register.
import { useEffect, useState } from 'react'
import { ladeEinstellungen, type PraxisEinstellungen } from '@/lib/einstellungen'
import { heuteIso } from '@/lib/stammdaten'
import { protokolliere } from '@/lib/konto'
import { ladeSitzungen, type Sitzung } from '@/lib/protokolle/daten'
import { einheiten, minuten } from '@/lib/protokolle/modell'
import { Teilnahmebestaetigung, VORLAGEN_FREIGEGEBEN } from './Vorlagen'

export function TeilnahmeAnsicht({ akteId, name, chiffre, schliessen }: { akteId: string; name: string; chiffre: string; schliessen: () => void }) {
  const [praxis, setPraxis] = useState<PraxisEinstellungen | null>(null)
  const [sitzungen, setSitzungen] = useState<Sitzung[]>([])
  const [von, setVon] = useState('')
  const [bis, setBis] = useState(heuteIso())
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    Promise.all([ladeEinstellungen(), ladeSitzungen()])
      .then(([p, s]) => {
        const eigene = s.filter((x) => x.akte_id === akteId && x.protokoll_status === 'abgeschlossen').sort((a, b) => a.datum.localeCompare(b.datum))
        setPraxis(p); setSitzungen(eigene); setVon(eigene[0]?.datum ?? heuteIso())
      })
      .catch((e) => setFehler(e.message))
  }, [akteId])

  if (fehler) return <p className="fehler">{fehler}</p>
  if (!praxis) return <p className="text-text-muted">Wird geladen …</p>
  const auswahl = sitzungen.filter((s) => s.datum >= von && s.datum <= bis).map((s) => ({ datum: s.datum, einheiten: einheiten(minuten(s.beginn, s.ende)) }))

  return (
    <div className="space-y-4">
      <div className="nicht-drucken flex flex-wrap items-end gap-3">
        <label>von<input type="date" value={von} onChange={(e) => setVon(e.target.value)} /></label>
        <label>bis<input type="date" value={bis} onChange={(e) => setBis(e.target.value)} /></label>
        <button className="btn btn-cta" onClick={() => { void protokolliere('bestaetigung_erstellt', chiffre); print() }}>Drucken / PDF</button>
        <button className="btn btn-ghost" onClick={schliessen}>← Zurück zum Register</button>
      </div>
      {!VORLAGEN_FREIGEGEBEN && <p className="nicht-drucken hinweis text-sm">Entwurf – Text vor der Verwendung rechtlich prüfen.</p>}
      {auswahl.length === 0 && <p className="nicht-drucken fehler">Im gewählten Zeitraum gibt es keine abgeschlossenen Gespräche.</p>}
      <Teilnahmebestaetigung praxis={praxis} daten={{ name, chiffre, sitzungen: auswahl }} />
    </div>
  )
}
