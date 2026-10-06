import brand from '@/config/brand.config'
import type { Auskunft } from '@/lib/auskunft'
import type { PraxisEinstellungen } from '@/lib/einstellungen'
import { euro } from '@/lib/finanzen/modell'
import { datum, zahl } from '@/lib/format'

/** Druckfassung der Auskunft (Art. 15 DSGVO) – aus AuskunftAnsicht und Druckvorschau. */
export function AuskunftDokument({ a, praxis }: { a: Auskunft; praxis: PraxisEinstellungen }) {
  const zeile = (titel: string, wert?: string | null) => wert ? <tr><th className="w-48 align-top">{titel}</th><td className="whitespace-pre-wrap">{wert}</td></tr> : null
  return (
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
  )
}
