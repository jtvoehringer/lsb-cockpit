'use client'
import { useEffect, useState } from 'react'
import { AuskunftDokument } from '@/components/AuskunftDokument'
import { HonorarnoteDokument } from '@/components/HonorarnoteDokument'
import { Jahresuebersicht } from '@/components/Jahresuebersicht'
import { NachweisDruck } from '@/components/NachweisDruck'
import { Notfallblatt } from '@/components/Notfallblatt'
import { ProtokollDruck } from '@/components/ProtokollDruck'
import { Beratungsvereinbarung, Datenschutzinformation, Entbindung, Teilnahmebestaetigung } from '@/components/Vorlagen'
import { ZusammenfassungDruck } from '@/components/ZusammenfassungDruck'
import type { Auskunft } from '@/lib/auskunft'
import { LEER, type PraxisEinstellungen, type ProtokollAusdruck } from '@/lib/einstellungen'
import type { Kategorie } from '@/lib/finanzen/daten'
import type { Honorarnote } from '@/lib/finanzen/honorarnoten'
import { jahresuebersicht } from '@/lib/finanzen/modell'
import { FRISTEN_STANDARD } from '@/lib/fristen'
import type { Sitzung } from '@/lib/protokolle/daten'
import type { Inhalt } from '@/lib/protokolle/modell'

// Alle Daten erfunden. Absichtlich lange Texte, damit Umbrüche und Seitenränder geprüft werden.
const LANG = 'Die Klientin schildert anhaltende Belastung durch einen Konflikt am Arbeitsplatz mit wiederkehrenden Auseinandersetzungen im Team, Schlafproblemen seit mehreren Wochen und dem Wunsch, ihre eigenen Grenzen klarer zu kommunizieren, ohne die gute Zusammenarbeit mit den Kolleginnen zu gefährden; außerdem Überlegungen zu einer beruflichen Neuorientierung.'
const praxis: PraxisEinstellungen = { ...LEER, name: 'Musterpraxis e.U. (fiktiv)', strasse: 'Musterstraße 1', plz_ort: '1010 Wien', telefon: '+43 660 000 0000', email: 'praxis@example.invalid', iban: 'AT611904300234573201', bic: 'BKAUATWW', bank: 'Musterbank', honorarsatz: 90 }
const ausdruck: ProtokollAusdruck = { beraterin: 'Erika Musterfrau (fiktiv)', institut: 'Musterakademie (Musterstraße 1, 1010 Wien) – fiktiv' }

function sitzung(nr: number, datum: string, art: 'erst' | 'folge', ausbildung = true): Sitzung {
  return {
    id: `s${nr}`, akte_id: nr % 2 ? 'a1' : 'a2', nr, art, datum, beginn: '14:00', ende: '15:40', arbeitseinheiten: 2, vorbereitung_min: 15, nachbereitung_min: 20,
    prozess_abgeschlossen: nr === 6, protokoll_status: nr === 5 ? 'entwurf' : 'abgeschlossen', abgeschlossen_am: `${datum}T18:00:00Z`, entwurf_enc: null,
    in_ausbildung: ausbildung, herkunft: null, erstellt_am: `${datum}T18:00:00Z`, geaendert_am: `${datum}T18:00:00Z`,
  }
}
const sitzungen = [sitzung(1, '2024-06-02', 'erst'), sitzung(2, '2024-06-16', 'folge'), sitzung(3, '2024-10-29', 'erst'), sitzung(4, '2024-11-02', 'folge'), sitzung(5, '2026-10-01', 'folge', false), sitzung(6, '2026-10-05', 'folge', false)]
const chiffreVon = new Map([['a1', 'K-24-0001-DK'], ['a2', 'K-24-0002-FU']])
const inhalt = (i: number): Inhalt => ({
  supervision: i === 1,
  felder: { anliegen: i % 2 ? LANG : 'Kurzes Thema: Entscheidung über Weiterbildung.', ziele: 'Klarheit über nächste Schritte; konkrete Formulierungen für das Gespräch mit der Teamleitung.', rahmen: 'Wöchentliche Termine, 100 Minuten.', verlauf: LANG + '\n\n' + LANG, ergebnis: 'Vereinbarung: Tagebuch zu Belastungsmomenten, nächster Termin in zwei Wochen.' },
})
const teile = sitzungen.map((s, i) => ({ s, chiffre: chiffreVon.get(s.akte_id)!, inhalt: inhalt(i + 1), fassungen: i === 2 ? 2 : 1 }))

const note: Honorarnote = {
  id: 'h1', jahr: 2026, laufnr: 7, nummer: '2026-0007', datum: '2026-10-05', akte_id: 'a1', sitzung_ids: ['s5', 's6'], betrag: 360, status: 'offen', bezahlt_am: null, buchung_id: null,
  inhalt: {
    empfaenger: { name: 'Maria Mustermann-Beispielhaft (fiktiv)', adresse: 'Beispielgasse 12/3/45\n1234 Musterhausen an der langen Straße' },
    positionen: [
      { datum: '2026-10-01', text: 'Lebens- und Sozialberatung – Einzelberatung inklusive Vor- und Nachbereitung, ausführliche Leistungsbeschreibung zum Testen des Umbruchs', einheiten: 2, satz: 90, betrag: 180 },
      { datum: '2026-10-05', text: 'Lebens- und Sozialberatung – Einzelberatung', einheiten: 2, satz: 90, betrag: 180 },
    ],
    hinweis: 'Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung gemäß § 6 Abs. 1 Z 27 UStG.',
  },
}

const auskunft: Auskunft = {
  erstellt_am: '2026-10-06T10:00:00Z', chiffre: 'K-24-0001-DK',
  person: { name: 'Maria Mustermann (fiktiv)', vorname: 'Maria', nachname: 'Mustermann', adresse: 'Beispielgasse 12/3/45, 1234 Musterhausen', notiz: 'Bevorzugt Termine am Nachmittag; ' + LANG },
  stammdaten: { geburtsjahr: '1985', telefon: '+43 660 111 2222', email: 'maria@example.invalid', minderjaehrig: false, erziehungsberechtigte: '', notfallkontakt: 'Max Mustermann, +43 660 333 4444', notiz: '' } as unknown as Auskunft['stammdaten'],
  einwilligungen: [{ art: 'Verarbeitung von Gesundheitsdaten (Art. 9 DSGVO)', erteilt_am: '2024-06-02', notiz: 'schriftlich, Scan hinterlegt' }, { art: 'Kontakt per E-Mail', erteilt_am: '2024-06-02', widerrufen_am: '2025-01-10' }],
  dokumente: [{ art: 'Unterlagen / Befunde', name: 'befund-hausaerztin-2026-03-mit-sehr-langem-dateinamen-zum-test.pdf', hochgeladen_am: '2026-03-15T10:00:00Z' }],
  sitzungen: teile.slice(0, 3).map(({ s, inhalt: x }) => ({ nr: s.nr, datum: s.datum, art: s.art === 'erst' ? 'Erstgespräch' : 'Beratungsgespräch', beginn: s.beginn, ende: s.ende, einheiten: 2, status: 'abgeschlossen', fassungen: 1, abschnitte: [{ titel: 'Anliegen', text: x.felder.anliegen ?? '' }, { titel: 'Verlauf', text: x.felder.verlauf ?? '' }] })),
  honorarnoten: [{ nummer: '2026-0007', datum: '2026-10-05', betrag: 360, status: 'offen' }],
  aufbewahrung: { status: 'offen', abschluss: null, bis: null },
}

const kategorien: Kategorie[] = [
  { id: 'k1', name: 'Honorare Lebens- und Sozialberatung', art: 'einnahme', e1a_kz: '9040', sortierung: 1, aktiv: true },
  { id: 'k2', name: 'Fortbildung, Supervision und Fachliteratur (sehr langer Kategoriename zum Testen)', art: 'ausgabe', e1a_kz: '9230', sortierung: 2, aktiv: true },
  { id: 'k3', name: 'Raummiete', art: 'ausgabe', e1a_kz: '9180', sortierung: 3, aktiv: true },
]
const ue = jahresuebersicht([
  { monat: 1, art: 'einnahme', kategorie_id: 'k1', summe: 1260, anzahl: 7 }, { monat: 2, art: 'einnahme', kategorie_id: 'k1', summe: 990, anzahl: 5 },
  { monat: 2, art: 'ausgabe', kategorie_id: 'k2', summe: 480.5, anzahl: 2 }, { monat: 3, art: 'ausgabe', kategorie_id: 'k3', summe: 1200, anzahl: 1 },
])

const ARTEN = ['protokoll', 'sammeldruck', 'zusammenfassung', 'nachweis', 'honorarnote', 'auskunft', 'jahresuebersicht', 'notfallblatt', 'datenschutz', 'vereinbarung', 'entbindung', 'teilnahme'] as const
type Art = typeof ARTEN[number]

export function Vorschau() {
  const [art, setArt] = useState<Art | null>(null)
  useEffect(() => { setArt((new URLSearchParams(location.search).get('art') as Art) ?? 'protokoll') }, [])
  if (!art) return null
  const t0 = teile[0]
  const inhaltDerArt: Record<Art, React.ReactNode> = {
    protokoll: <ProtokollDruck art={t0.s.art} nr={t0.s.nr} chiffre={t0.chiffre} kopf={t0.s} inhalt={t0.inhalt} entwurf={false} abgeschlossenAm={t0.s.abgeschlossen_am} fassungen={1} ausdruck={ausdruck} />,
    sammeldruck: teile.slice(0, 3).map((t, i) => (
      <article key={t.s.id} style={{ breakAfter: i < 2 ? 'page' : 'auto' }}>
        <ProtokollDruck art={t.s.art} nr={t.s.nr} chiffre={t.chiffre} kopf={t.s} inhalt={t.inhalt} entwurf={t.s.protokoll_status === 'entwurf'} abgeschlossenAm={t.s.abgeschlossen_am} fassungen={t.fassungen} ausdruck={ausdruck} />
      </article>
    )),
    zusammenfassung: <ZusammenfassungDruck zeilen={teile} ausdruck={ausdruck} />,
    nachweis: <div className="space-y-6"><NachweisDruck zeilen={sitzungen} chiffreVon={chiffreVon} von="2024-01-01" bis="" auswahl="alle Protokolle" /></div>,
    honorarnote: <HonorarnoteDokument n={note} e={praxis} />,
    auskunft: <AuskunftDokument a={auskunft} praxis={praxis} />,
    jahresuebersicht: <div className="space-y-6"><Jahresuebersicht jahr={2026} ue={ue} kategorien={kategorien} /></div>,
    notfallblatt: <Notfallblatt email="erika@example.invalid" code="ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345" adresse="https://lsb.icp-consultants.at" />,
    datenschutz: <Datenschutzinformation praxis={praxis} fristen={FRISTEN_STANDARD} />,
    vereinbarung: <Beratungsvereinbarung praxis={praxis} fristen={FRISTEN_STANDARD} />,
    entbindung: <Entbindung praxis={praxis} />,
    teilnahme: <Teilnahmebestaetigung praxis={praxis} daten={{ name: 'Maria Mustermann (fiktiv)', chiffre: 'K-24-0001-DK', sitzungen: sitzungen.slice(0, 4).map((s) => ({ datum: s.datum, einheiten: 2 })) }} />,
  }
  return <main className="mx-auto max-w-5xl px-4 py-8">{inhaltDerArt[art]}</main>
}
