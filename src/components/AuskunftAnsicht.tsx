'use client'
// Auskunft nach Art. 15 DSGVO (Druck/PDF) und Datenübertragbarkeit nach Art. 20 (JSON) – lokal erzeugt.
import { useEffect, useState } from 'react'
import { AuskunftDokument } from './AuskunftDokument'
import { sammleAuskunft, type Auskunft } from '@/lib/auskunft'
import { ladeEinstellungen, type PraxisEinstellungen } from '@/lib/einstellungen'
import { protokolliere } from '@/lib/konto'
import { useTresor } from '@/lib/tresor'

export function AuskunftAnsicht({ akteId, schliessen }: { akteId: string; schliessen: () => void }) {
  const tresor = useTresor()
  const [a, setA] = useState<Auskunft | null>(null)
  const [praxis, setPraxis] = useState<PraxisEinstellungen | null>(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    const k = { a: tresor.schluessel('zone_a'), b: tresor.schluessel('zone_b'), c: tresor.schluessel('zone_c') }
    Promise.all([sammleAuskunft(k, akteId), ladeEinstellungen()])
      .then(async ([x, p]) => { setA(x); setPraxis(p); await protokolliere('auskunft_erstellt', x.chiffre) })
      .catch((e) => setFehler(e.message))
  }, [akteId, tresor])

  function json() {
    if (!a) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(a, null, 2)], { type: 'application/json' }))
    const l = document.createElement('a'); l.href = url; l.download = `auskunft-${a.chiffre}-${a.erstellt_am.slice(0, 10)}.json`; l.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  if (fehler) return <div className="space-y-4"><p className="fehler">{fehler}</p><button className="btn btn-ghost" onClick={schliessen}>Zurück</button></div>
  if (!a || !praxis) return <p className="text-text-muted">Auskunft wird zusammengestellt und entschlüsselt …</p>


  return (
    <div className="space-y-6">
      <div className="nicht-drucken flex flex-wrap items-center justify-between gap-3">
        <div><p className="overline">Register · Auskunft</p><h1 className="mt-2 font-heading text-heading">Auskunft {a.chiffre}</h1></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-cta" onClick={() => print()}>Drucken / PDF</button>
          <button className="btn btn-ghost" onClick={json}>JSON (Datenübertragbarkeit)</button>
          <button className="btn btn-ghost" onClick={schliessen}>← Zurück zum Register</button>
        </div>
      </div>
      <p className="nicht-drucken hinweis text-sm">Streng vertraulich. Die Auskunft enthält alle Daten zu dieser Person. Nur persönlich oder über einen sicheren Weg übergeben – nicht unverschlüsselt per E-Mail. Frist: ein Monat ab Eingang der Anfrage.</p>

      <AuskunftDokument a={a} praxis={praxis} />
    </div>
  )
}
