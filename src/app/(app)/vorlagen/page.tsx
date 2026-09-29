'use client'
import { useEffect, useState } from 'react'
import { Beratungsvereinbarung, Datenschutzinformation, Entbindung, VORLAGEN_FREIGEGEBEN, VORLAGEN_STAND } from '@/components/Vorlagen'
import { ladeEinstellungen, ladeFristen, type PraxisEinstellungen } from '@/lib/einstellungen'
import type { FristEinstellungen } from '@/lib/fristen'

const LISTE = [
  { id: 'datenschutz', titel: 'Information zum Datenschutz', text: 'Vor dem Erstgespräch aushändigen (Art. 13 DSGVO).' },
  { id: 'vereinbarung', titel: 'Beratungsvereinbarung mit Einwilligungen', text: 'Beim Erstgespräch unterschreiben lassen; danach im Register unter „Stammdaten“ erfassen und den Scan hochladen.' },
  { id: 'entbindung', titel: 'Entbindung von der Verschwiegenheit', text: 'Nur bei Bedarf, mit Empfänger, Zweck und Umfang.' },
] as const
type Id = (typeof LISTE)[number]['id']

export default function Vorlagen() {
  const [praxis, setPraxis] = useState<PraxisEinstellungen | null>(null)
  const [fristen, setFristen] = useState<FristEinstellungen | null>(null)
  const [gewaehlt, setGewaehlt] = useState<Id | null>(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => { Promise.all([ladeEinstellungen(), ladeFristen()]).then(([p, f]) => { setPraxis(p); setFristen(f) }).catch((e) => setFehler(e.message)) }, [])

  if (fehler) return <p className="fehler">{fehler}</p>
  if (!praxis || !fristen) return <p className="text-text-muted">Wird geladen …</p>

  if (gewaehlt) return (
    <div className="space-y-4">
      <div className="nicht-drucken flex flex-wrap gap-2">
        <button className="btn btn-cta" onClick={() => print()}>Drucken / PDF</button>
        <button className="btn btn-ghost" onClick={() => setGewaehlt(null)}>← Zurück zu den Vorlagen</button>
      </div>
      {!VORLAGEN_FREIGEGEBEN && <p className="nicht-drucken hinweis text-sm">Entwurf – die Texte sind Vorschläge und vor der Verwendung rechtlich zu prüfen. Der Ausdruck trägt deshalb einen Entwurfsvermerk.</p>}
      {gewaehlt === 'datenschutz' && <Datenschutzinformation praxis={praxis} fristen={fristen} />}
      {gewaehlt === 'vereinbarung' && <Beratungsvereinbarung praxis={praxis} fristen={fristen} />}
      {gewaehlt === 'entbindung' && <Entbindung praxis={praxis} />}
    </div>
  )

  return (
    <div className="max-w-3xl space-y-6">
      <div><p className="overline">Dokumentation</p><h1 className="mt-2 font-heading text-heading">Vorlagen</h1></div>
      <p className="text-sm text-text-muted">Zum Ausdrucken oder als PDF. Praxisangaben, Honorar und Aufbewahrungsfristen kommen aus den Einstellungen. {VORLAGEN_FREIGEGEBEN ? `Stand ${VORLAGEN_STAND}.` : `${VORLAGEN_STAND} – rechtlich noch nicht geprüft.`}</p>
      {!praxis.name && <p className="hinweis text-sm">Bitte zuerst unter „Einstellungen“ Name und Anschrift der Praxis eintragen – sie erscheinen im Briefkopf.</p>}
      <div className="grid gap-3">
        {LISTE.map((v) => (
          <button key={v.id} className="karte text-left hover:bg-sand" onClick={() => setGewaehlt(v.id)}>
            <b className="font-heading text-heading">{v.titel}</b>
            <span className="mt-1 block text-sm text-text-muted">{v.text}</span>
          </button>
        ))}
      </div>
      <p className="text-sm text-text-muted">Eine <b>Teilnahmebestätigung</b> mit Terminen und Einheiten einer Person erstellst du im Register bei der Person („Bestätigung“).</p>
    </div>
  )
}
