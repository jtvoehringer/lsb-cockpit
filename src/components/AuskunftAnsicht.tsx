'use client'
// Auskunft nach Art. 15 DSGVO (Druck/PDF) und Datenübertragbarkeit nach Art. 20 (JSON) – lokal erzeugt.
import { useEffect, useState } from 'react'
import brand from '@/config/brand.config'
import { sammleAuskunft, type Auskunft } from '@/lib/auskunft'
import { ladeEinstellungen, type PraxisEinstellungen } from '@/lib/einstellungen'
import { euro } from '@/lib/finanzen/modell'
import { datum, zahl } from '@/lib/format'
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

  const zeile = (titel: string, wert?: string | null) => wert ? <tr><th className="w-48 align-top">{titel}</th><td className="whitespace-pre-wrap">{wert}</td></tr> : null

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

      <article className="space-y-5 text-sm">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-text-subtle">Streng vertraulich · Auskunft nach Art. 15 DSGVO</p>
          <h2 className="font-heading text-2xl text-heading">Auskunft über gespeicherte Daten</h2>
          <p>{praxis.name || brand.appName}{praxis.berufsbezeichnung ? ` · ${praxis.berufsbezeichnung}` : ''}{praxis.strasse ? ` · ${praxis.strasse}, ${praxis.plz_ort}` : ''}</p>
          <p className="text-text-muted">Erstellt am {datum(a.erstellt_am)} · Kennung {a.chiffre}</p>
        </header>

        <section>
          <h3 className="font-heading text-lg text-heading">1. Person und Kontakt</h3>
          <table className="druck-tabelle mt-2 w-full"><tbody>
            {zeile('Name', a.person.name)}{zeile('Adresse', a.person.adresse)}
            {zeile('Geburtsjahr', a.stammdaten?.geburtsjahr)}{zeile('Telefon', a.stammdaten?.telefon)}{zeile('E-Mail', a.stammdaten?.email)}
            {zeile('Minderjährig', a.stammdaten?.minderjaehrig ? 'ja' : null)}{zeile('Erziehungsberechtigte', a.stammdaten?.erziehungsberechtigte)}
            {zeile('Notfallkontakt', a.stammdaten?.notfallkontakt)}{zeile('Notizen', [a.person.notiz, a.stammdaten?.notiz].filter(Boolean).join('\n'))}
          </tbody></table>
        </section>

        <section>
          <h3 className="font-heading text-lg text-heading">2. Einwilligungen und Vereinbarungen</h3>
          {a.einwilligungen.length === 0 ? <p className="mt-1 text-text-muted">Keine erfasst.</p> : (
            <table className="druck-tabelle mt-2 w-full"><thead><tr><th>Art</th><th>erteilt am</th><th>widerrufen am</th><th>Notiz</th></tr></thead>
              <tbody>{a.einwilligungen.map((e, i) => <tr key={i}><td>{e.art}</td><td>{datum(e.erteilt_am)}</td><td>{e.widerrufen_am ? datum(e.widerrufen_am) : '–'}</td><td>{e.notiz ?? ''}</td></tr>)}</tbody></table>
          )}
          {a.dokumente.length > 0 && <p className="mt-2">Gespeicherte Dokumente: {a.dokumente.map((d) => `${d.art} (${d.name}, ${datum(d.hochgeladen_am)})`).join('; ')}.</p>}
        </section>

        <section>
          <h3 className="font-heading text-lg text-heading">3. Beratungsgespräche und Protokolle</h3>
          {a.sitzungen.length === 0 && <p className="mt-1 text-text-muted">Keine gespeichert.</p>}
          {a.sitzungen.map((s) => (
            <div key={s.nr} className="mt-3 break-inside-avoid-page">
              <p className="font-medium text-heading">Nr. {s.nr} · {datum(s.datum)} · {s.art}{s.beginn && s.ende ? ` · ${s.beginn}–${s.ende}` : ''} · {zahl(s.einheiten)} Einheiten · {s.status}{s.fassungen > 1 ? ` · ${s.fassungen} Fassungen (jüngste abgedruckt)` : ''}</p>
              {s.abschnitte.map((x) => <div key={x.titel} className="mt-1"><p className="text-xs uppercase tracking-wider text-text-subtle">{x.titel}</p><p className="whitespace-pre-wrap">{x.text}</p></div>)}
            </div>
          ))}
        </section>

        <section>
          <h3 className="font-heading text-lg text-heading">4. Honorarnoten</h3>
          {a.honorarnoten.length === 0 ? <p className="mt-1 text-text-muted">Keine.</p> : (
            <table className="druck-tabelle mt-2 w-full"><thead><tr><th>Nummer</th><th>Datum</th><th>Betrag</th><th>Status</th></tr></thead>
              <tbody>{a.honorarnoten.map((h) => <tr key={h.nummer}><td>{h.nummer}</td><td>{datum(h.datum)}</td><td>{euro(h.betrag)}</td><td>{h.status}</td></tr>)}</tbody></table>
          )}
        </section>

        <section>
          <h3 className="font-heading text-lg text-heading">5. Zweck, Speicherung und Rechte</h3>
          <p className="mt-1">Zweck: Dokumentation der Lebens- und Sozialberatung und Abrechnung. Die Daten werden auf dem Gerät der Beraterin verschlüsselt und verschlüsselt bei Auftragsverarbeitern in der EU gespeichert (Datenbank: Supabase, Frankfurt; Auslieferung: Vercel; Betrieb: ICP Solutions). Diese können die Inhalte nicht lesen.</p>
          <p className="mt-1">Aufbewahrung: {a.aufbewahrung.bis ? `bis ${datum(a.aufbewahrung.bis)}` : a.aufbewahrung.status === 'offen' ? 'Beratung läuft; die Frist beginnt mit dem Abschluss' : '–'}. Honorarnoten werden aus steuerrechtlichen Gründen 7 Jahre aufbewahrt.</p>
          <p className="mt-1">Sie haben das Recht auf Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerruf erteilter Einwilligungen sowie auf Beschwerde bei der Datenschutzbehörde (dsb.gv.at).</p>
        </section>
      </article>
    </div>
  )
}
