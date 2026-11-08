'use client'
// Druckvorlagen für Klientinnen und Klienten (R-05, R-16, F-11). Praxisangaben und Fristen aus den Einstellungen.
// Texte rechtlich geprüft und freigegeben am 04.10.2026 (Doris Dvorak; ROK Akademie). Bei inhaltlichen Änderungen erneut prüfen lassen und VORLAGEN_STAND anpassen.
import { EINHEIT_MIN } from '@/lib/protokolle/modell'
import type { PraxisEinstellungen } from '@/lib/einstellungen'
import { euro } from '@/lib/finanzen/modell'
import { datum, zahl } from '@/lib/format'
import type { FristEinstellungen } from '@/lib/fristen'

export const VORLAGEN_FREIGEGEBEN = true
export const VORLAGEN_STAND = '04.10.2026'

type Basis = { praxis: PraxisEinstellungen; fristen: FristEinstellungen }

function Briefkopf({ praxis, titel }: { praxis: PraxisEinstellungen; titel: string }) {
  return (
    <header className="mb-5 space-y-1 border-b border-border pb-3">
      <p className="font-heading text-lg text-heading">{praxis.name || 'Name der Praxis (Einstellungen)'}</p>
      <p className="text-xs text-text-muted">{[praxis.berufsbezeichnung, [praxis.strasse, praxis.plz_ort].filter(Boolean).join(', '), praxis.telefon, praxis.email].filter(Boolean).join(' · ')}</p>
      <h2 className="pt-3 font-heading text-2xl text-heading">{titel}</h2>
    </header>
  )
}

function Fuss() {
  return (
    <footer className="mt-6 border-t border-border pt-2 text-[9pt] text-text-subtle">
      {VORLAGEN_FREIGEGEBEN ? `Stand: ${VORLAGEN_STAND.replace('Entwurf vom ', '')}` : `ENTWURF – vor Verwendung rechtlich prüfen · ${VORLAGEN_STAND}`}
    </footer>
  )
}

const Linie = ({ text }: { text: string }) => (
  <div className="mt-6"><div className="h-6 border-b border-text" /><p className="mt-1 text-[9pt] text-text-muted">{text}</p></div>
)
const Kasten = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 flex gap-3"><span className="mt-0.5 inline-block h-4 w-4 flex-none border border-text" /> <span>{children}</span></p>
)
const H = ({ children }: { children: React.ReactNode }) => <h3 className="mt-4 font-heading text-base text-heading">{children}</h3>

export function Datenschutzinformation({ praxis, fristen }: Basis) {
  const verantwortlich = [praxis.name, praxis.strasse, praxis.plz_ort, praxis.telefon, praxis.email].filter(Boolean).join(', ')
  return (
    <article className="text-[10.5pt] leading-relaxed">
      <Briefkopf praxis={praxis} titel="Information zum Datenschutz" />
      <p>Mit dieser Information erfahren Sie, welche Daten ich im Rahmen der Lebens- und Sozialberatung verarbeite, wofür und wie lange – und welche Rechte Sie haben (Art. 13 DSGVO).</p>
      <section className="break-inside-avoid"><H>1. Verantwortliche</H>
      <p>{verantwortlich || 'Name, Anschrift und Kontakt der Praxis (unter „Einstellungen“ eintragen)'}</p></section>
      <section className="break-inside-avoid"><H>2. Welche Daten</H>
      <p>Kontaktdaten (Name, Adresse, Telefon, E-Mail), Geburtsjahr, bei Minderjährigen die Erziehungsberechtigten; Termine und Dauer der Beratung; die Inhalte der Beratungsgespräche in Form von Protokollen – diese können Angaben zu Ihrer Gesundheit und anderen besonders geschützten Lebensbereichen enthalten (Art. 9 DSGVO); Rechnungsdaten.</p></section>
      <section className="break-inside-avoid"><H>3. Zwecke und Rechtsgrundlagen</H>
      <ul className="list-disc pl-5">
        <li>Durchführung der vereinbarten Beratung (Art. 6 Abs. 1 lit. b DSGVO).</li>
        <li>Dokumentation der Beratung einschließlich Gesundheitsdaten – nur mit Ihrer ausdrücklichen Einwilligung (Art. 9 Abs. 2 lit. a DSGVO).</li>
        <li>Abrechnung und gesetzliche Aufbewahrung von Rechnungen (Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit § 132 BAO).</li>
        <li>Kommunikation per E-Mail nur, wenn Sie dem zustimmen.</li>
      </ul></section>
      <section className="break-inside-avoid"><H>4. Verschwiegenheit und Schutz</H>
      <p>Ich unterliege der beruflichen Verschwiegenheit. Meine Aufzeichnungen werden auf meinem Gerät verschlüsselt, bevor sie gespeichert werden. Die eingesetzten Dienstleister können die Inhalte nicht lesen. Protokolle enthalten statt Ihres Namens eine Kennung (Chiffre).</p></section>
      <section className="break-inside-avoid"><H>5. Empfänger</H>
      <p>Ihre Daten gebe ich nicht an Dritte weiter, außer Sie willigen ein oder ich bin gesetzlich dazu verpflichtet. Für den technischen Betrieb setze ich Auftragsverarbeiter ein, die ausschließlich verschlüsselte Inhalte erhalten: ICP Solutions (IC&amp;P Consultants e.U., IT-Betreuung), Supabase Inc. (Datenspeicherung in Frankfurt am Main), Vercel Inc. (Bereitstellung der Anwendung). Für E-Mail und Termine nutze ich Microsoft 365. Rechnungsdaten erhält meine Steuerberatung.</p></section>
      <section className="break-inside-avoid"><H>6. Übermittlung in Drittländer</H>
      <p>Supabase, Vercel und Microsoft sind Unternehmen mit Sitz bzw. Muttergesellschaft in den USA. Die Daten werden in der EU gespeichert; ein Zugriff aus den USA ist dennoch nicht ausgeschlossen. Grundlage sind das EU-US Data Privacy Framework bzw. EU-Standardvertragsklauseln. Beratungsinhalte liegen dort nur verschlüsselt vor.</p></section>
      <section className="break-inside-avoid"><H>7. Speicherdauer</H>
      <p>Die Beratungsdokumentation bewahre ich {fristen.standard_jahre} Jahre nach Abschluss der Beratung auf, mit Ihrer Zustimmung {fristen.zustimmung_jahre} Jahre{fristen.minderjaehrige_ab_volljaehrigkeit ? '; bei Minderjährigen beginnt die Frist mit Erreichen der Volljährigkeit' : ''}. Rechnungen werden 7 Jahre aufbewahrt. Danach werden die Daten gelöscht.</p></section>
      <section className="break-inside-avoid"><H>8. Ihre Rechte</H>
      <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Eine Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen. Sie können sich bei der Datenschutzbehörde beschweren (Barichgasse 40–42, 1030 Wien, dsb@dsb.gv.at, www.dsb.gv.at).</p></section>
      <section className="break-inside-avoid"><H>9. Pflicht zur Bereitstellung</H>
      <p>Ohne die Einwilligung zur Dokumentation (Punkt 3) kann ich die Beratung nicht dokumentieren. Bitte sprechen Sie mich in diesem Fall an. Eine automatisierte Entscheidungsfindung findet nicht statt.</p></section>
      <Fuss />
    </article>
  )
}

export function Beratungsvereinbarung({ praxis, fristen }: Basis) {
  return (
    <article className="text-[10.5pt] leading-relaxed">
      <Briefkopf praxis={praxis} titel="Beratungsvereinbarung" />
      <p>zwischen <b>{praxis.name || 'Name der Praxis'}</b> (Beraterin) und</p>
      <Linie text="Name der Klientin / des Klienten" />
      <Linie text="Anschrift" />
      <section className="break-inside-avoid"><H>1. Gegenstand</H>
      <p>Lebens- und Sozialberatung: Beratung und Begleitung von Menschen in Problem- und Entscheidungssituationen. Die Beratung ist keine Psychotherapie und keine medizinische Behandlung und ersetzt diese nicht.</p></section>
      <section className="break-inside-avoid"><H>2. Termine und Honorar</H>
      <p>Eine Beratungseinheit dauert {EINHEIT_MIN} Minuten. Das Honorar beträgt {praxis.honorarsatz ? euro(praxis.honorarsatz) : '€ ____'} je Einheit{praxis.hinweis?.includes('Kleinunternehmer') ? ' (umsatzsteuerfrei, Kleinunternehmerregelung)' : ''} und ist bar oder binnen {praxis.zahlungsziel_tage || 14} Tagen nach Erhalt der Honorarnote zu bezahlen. Termine, die nicht spätestens 24 Stunden vorher abgesagt werden, können verrechnet werden.</p></section>
      <section className="break-inside-avoid"><H>3. Verschwiegenheit</H>
      <p>Die Beraterin ist zur Verschwiegenheit über alles verpflichtet, was ihr in der Beratung anvertraut wird. Ausnahmen bestehen nur bei gesetzlichen Pflichten oder wenn das Leben oder die Gesundheit einer Person ernsthaft gefährdet ist.</p></section>
      <section className="break-inside-avoid"><H>4. Datenschutz</H>
      <p>Die Information zum Datenschutz habe ich erhalten.</p></section>
      <div className="break-inside-avoid">
      <H>5. Einwilligungen (bitte gesondert ankreuzen)</H>
      <Kasten><b>Dokumentation (erforderlich):</b> Ich willige ausdrücklich ein, dass Angaben zu meiner Gesundheit und zu anderen besonders geschützten Lebensbereichen, die ich in der Beratung mitteile, zum Zweck der Beratung und ihrer Dokumentation verarbeitet werden (Art. 9 Abs. 2 lit. a DSGVO).</Kasten>
      <Kasten><b>E-Mail:</b> Ich bin einverstanden, dass die Beraterin mich zu Terminen und organisatorischen Fragen per unverschlüsselter E-Mail kontaktiert: ________________________________</Kasten>
      <Kasten><b>Längere Aufbewahrung:</b> Ich bin einverstanden, dass die Dokumentation {fristen.zustimmung_jahre} statt {fristen.standard_jahre} Jahre aufbewahrt wird (z. B. damit eine spätere Fortsetzung der Beratung möglich ist).</Kasten>
      <p className="mt-3 text-[9.5pt]">Jede Einwilligung ist freiwillig und kann jederzeit formlos mit Wirkung für die Zukunft widerrufen werden; die bis dahin erfolgte Verarbeitung bleibt rechtmäßig.</p>
      <div className="mt-6 grid grid-cols-2 gap-x-8">
        <Linie text="Ort, Datum" /><div />
        <Linie text="Unterschrift Klientin / Klient" /><Linie text="Unterschrift Beraterin" />
        <Linie text="bei Minderjährigen: Unterschrift Erziehungsberechtigte" /><div />
      </div>
      </div>
      <Fuss />
    </article>
  )
}

export function Entbindung({ praxis }: { praxis: PraxisEinstellungen }) {
  return (
    <article className="text-[10.5pt] leading-relaxed">
      <Briefkopf praxis={praxis} titel="Entbindung von der Verschwiegenheit" />
      <Linie text="Name der Klientin / des Klienten" />
      <p className="mt-4">Ich entbinde {praxis.name || 'die Beraterin'} gegenüber der folgenden Person bzw. Stelle von der Verschwiegenheit:</p>
      <Linie text="Name / Stelle, Anschrift" />
      <Linie text="Zweck (wofür werden die Informationen benötigt?)" />
      <Linie text="Umfang (welche Informationen?)" />
      <Linie text="gültig bis" />
      <p className="mt-4 text-[9.5pt]">Diese Entbindung ist freiwillig und kann jederzeit formlos mit Wirkung für die Zukunft widerrufen werden.</p>
      <div className="mt-4 grid grid-cols-2 gap-x-8">
        <Linie text="Ort, Datum" /><Linie text="Unterschrift" />
      </div>
      <Fuss />
    </article>
  )
}

export type TeilnahmeDaten = { name: string; chiffre: string; sitzungen: { datum: string; einheiten: number }[] }

export function Teilnahmebestaetigung({ praxis, daten }: { praxis: PraxisEinstellungen; daten: TeilnahmeDaten }) {
  const summe = daten.sitzungen.reduce((s, x) => s + x.einheiten, 0)
  return (
    <article className="text-[10.5pt] leading-relaxed">
      <Briefkopf praxis={praxis} titel="Teilnahmebestätigung" />
      <p>Hiermit bestätige ich, dass <b>{daten.name || '________________'}</b> an folgenden Einheiten der Lebens- und Sozialberatung (je {EINHEIT_MIN} Minuten) teilgenommen hat:</p>
      <table className="druck-tabelle mt-3 w-full max-w-md">
        <thead><tr><th>Datum</th><th>Einheiten</th></tr></thead>
        <tbody>{daten.sitzungen.map((s, i) => <tr key={i}><td>{datum(s.datum)}</td><td>{zahl(s.einheiten)}</td></tr>)}</tbody>
        <tfoot><tr><th>Summe</th><th>{zahl(summe)}</th></tr></tfoot>
      </table>
      <p className="mt-3 text-[9.5pt]">Über Inhalte der Beratung gibt diese Bestätigung keine Auskunft.</p>
      <div className="mt-4 grid grid-cols-2 gap-x-8">
        <Linie text="Ort, Datum" /><Linie text={`Unterschrift ${praxis.name || 'Beraterin'}`} />
      </div>
      <Fuss />
    </article>
  )
}
