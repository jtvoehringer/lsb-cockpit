// Protokoll-Modell: Arten, Felder (WKO-Gliederung), Zeiten und Einheiten, Chiffre. Ohne Datenbank und Krypto – gut testbar.

export const EINHEIT_MIN = 60

export type Art = 'erst' | 'folge'
export type Feld = 'anliegen' | 'ziele' | 'rahmen' | 'verlauf' | 'ergebnis'

export const ART: Record<Art, { titel: string; kurz: string; felder: [Feld, string][] }> = {
  erst: {
    titel: 'Protokoll Erstgespräch',
    kurz: 'Erstgespräch',
    felder: [
      ['anliegen', 'Ausgangslage, Anliegen, Thema'],
      ['ziele', 'Ziele, Kriterien zur Zielerreichung'],
      ['rahmen', 'Rahmenbedingungen'],
      ['verlauf', 'Verlauf, Maßnahmen, Interventionen'],
      ['ergebnis', 'Ergebnisse, future pace'],
    ],
  },
  folge: {
    titel: 'Protokoll Beratungsgespräch',
    kurz: 'Beratungsgespräch',
    felder: [
      ['anliegen', 'Anliegen, Thema, Zielableitung'],
      ['verlauf', 'Verlauf, Maßnahmen, Interventionen'],
      ['ergebnis', 'Zielerreichung, future pace'],
    ],
  },
}

/** Verschlüsselter Inhalt eines Protokolls (Zone B) */
export type Inhalt = { felder: Partial<Record<Feld, string>>; supervision: boolean }

/** Dauer in Minuten aus „HH:MM“; über Mitternacht wird korrekt gerechnet */
export function minuten(beginn?: string | null, ende?: string | null): number {
  if (!beginn || !ende) return 0
  const [h1, m1] = beginn.split(':').map(Number), [h2, m2] = ende.split(':').map(Number)
  if ([h1, m1, h2, m2].some((x) => Number.isNaN(x))) return 0
  let d = h2 * 60 + m2 - (h1 * 60 + m1)
  if (d < 0) d += 24 * 60
  return d
}

/** Arbeitseinheiten zu EINHEIT_MIN Minuten (seit 08.11.2026: 60, vorher 50), auf zwei Stellen gerundet */
export const einheiten = (min: number) => Math.round((min / EINHEIT_MIN) * 100) / 100

// ---------- Chiffre K-JJ-NNNN-XX (Lösungsdesign 5.4) ----------
// JJ = Jahr des Erstkontakts, NNNN = laufende Nummer im Jahr, XX = zwei Zufallsbuchstaben ohne I und O.
export const CHIFFRE_BUCHSTABEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
export const CHIFFRE_MUSTER = /^(T-)?K-(\d{2})-(\d{4})-([A-HJ-NP-Z]{2})$/

export function naechsteChiffre(vorhandene: string[], jahr: number, test = false, zufall: () => number = gleichverteilt): string {
  const jj = String(jahr % 100).padStart(2, '0')
  let max = 0
  for (const c of vorhandene) {
    const m = CHIFFRE_MUSTER.exec(c)
    if (m && m[2] === jj) max = Math.max(max, Number(m[3]))
  }
  if (max >= 9999) throw new Error('Chiffren für dieses Jahr erschöpft')
  const xx = CHIFFRE_BUCHSTABEN[zufall()] + CHIFFRE_BUCHSTABEN[zufall()]
  return `${test ? 'T-' : ''}K-${jj}-${String(max + 1).padStart(4, '0')}-${xx}`
}

/** Gleichverteilte Zufallszahl 0–23 (Verwerfungsverfahren, kein Modulo-Bias) */
function gleichverteilt(): number {
  const b = new Uint8Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(b)
    if (b[0] < 240) return b[0] % 24
  }
}

/** Früheste zulässige Beratung: Protokolle aus der Ausbildungszeit ab 2024 können nachgetragen werden (Praxisnachweis). */
export const PROTOKOLL_AB_JAHR = 2024

/** Jahr (vierstellig) aus der Chiffre, z. B. K-25-0003-AB → 2025 */
export function chiffreJahr(chiffre: string): number | null {
  const m = CHIFFRE_MUSTER.exec(chiffre)
  return m ? 2000 + Number(m[2]) : null
}

/** Prüft ein Beratungsdatum (JJJJ-MM-TT): nicht vor PROTOKOLL_AB_JAHR und nicht in einem künftigen Jahr. Liefert Fehlertext oder null. */
export function pruefeDatum(datum: string, heute = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return 'Bitte ein gültiges Datum eingeben.'
  const j = Number(datum.slice(0, 4))
  if (j < PROTOKOLL_AB_JAHR) return `Protokolle sind ab ${PROTOKOLL_AB_JAHR} möglich.`
  if (j > heute.getFullYear()) return 'Das Datum liegt in einem künftigen Jahr.'
  return null
}

/** Vermerk für Protokolle mit Häkchen „in Ausbildung“ (Ausdruck und Nachweisliste) */
export const AUSBILDUNG_VERMERK = 'Vermerk: Beratung im Rahmen der Ausbildung zur Lebens- und Sozialberaterin (vor Erteilung der Gewerbeberechtigung)'

/** Vorname und Nachname zum vollen Namen zusammensetzen */
export const vollerName = (vorname?: string, nachname?: string) => [vorname?.trim(), nachname?.trim()].filter(Boolean).join(' ')

/** Bisherigen Namen „Vorname Nachname“ teilen: letztes Wort = Nachname, davor Vorname(n); ein einzelnes Wort gilt als Nachname. */
export function nameTeilen(name: string): { vorname: string; nachname: string } {
  const teile = name.trim().split(/\s+/).filter(Boolean)
  if (teile.length < 2) return { vorname: '', nachname: teile[0] ?? '' }
  return { vorname: teile.slice(0, -1).join(' '), nachname: teile[teile.length - 1] }
}

export const leererInhalt = (): Inhalt => ({ felder: {}, supervision: false })

// ── Nummern nach Beratungsdatum (seit 08.11.2026; die Datenbank nummeriert per Trigger `sitzung_nummern_nach_datum` lückenlos neu) ──
export type NrZeile = { id: string; nr: number; datum: string; beginn: string | null; erstellt_am: string }
const schluessel = (z: Pick<NrZeile, 'datum' | 'beginn' | 'erstellt_am' | 'id'>) => [z.datum, z.beginn ?? '~', z.erstellt_am, z.id] as const
function vor(a: readonly string[], b: readonly string[]) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false }

/** Wo landet ein (neues oder geändertes) Protokoll? Gleiche Reihenfolge wie in der Datenbank: Datum, Beginn (ohne Zeit zuletzt), Erfassung. */
export function einordnung(alle: NrZeile[], datum: string, beginn: string | null = null, eigen?: Pick<NrZeile, 'id' | 'erstellt_am'>) {
  const andere = alle.filter((z) => z.id !== eigen?.id).sort((a, b) => (vor(schluessel(a), schluessel(b)) ? -1 : 1))
  const ich = schluessel({ datum, beginn, erstellt_am: eigen?.erstellt_am ?? '9999', id: eigen?.id ?? '~' })
  const nr = andere.filter((z) => vor(schluessel(z), ich)).length + 1
  const verschoben = andere.map((z, i) => ({ alt: z.nr, neu: i + 1 + (i + 1 >= nr ? 1 : 0) })).filter((x) => x.alt !== x.neu)
  return { nr, verschoben, amTag: andere.filter((z) => z.datum === datum) }
}

/** Hinweistext vor dem Anlegen/Ändern (null = nichts zu melden) */
export function einordnungsHinweis(e: ReturnType<typeof einordnung>, datumText: string, bisher?: number): string | null {
  const teile: string[] = []
  if (e.amTag.length) teile.push(`Am ${datumText} ${e.amTag.length === 1 ? 'gibt es bereits ein Protokoll' : `gibt es bereits ${e.amTag.length} Protokolle`} (Nr. ${e.amTag.map((z) => z.nr).sort((a, b) => a - b).join(', ')}).`)
  const sinkt = e.verschoben.filter((x) => x.neu > x.alt).map((x) => x.alt), steigt = e.verschoben.filter((x) => x.neu < x.alt).map((x) => x.alt)
  if (bisher === undefined ? sinkt.length : bisher !== e.nr) {
    const bereich = (n: number[]) => n.length === 1 ? `Nr. ${n[0]} rückt` : `Nr. ${Math.min(...n)}–${Math.max(...n)} rücken`
    teile.push(`Nummern folgen dem Beratungsdatum: ${bisher === undefined ? `das neue Protokoll bekommt Nr. ${e.nr}` : `dieses Protokoll wird von Nr. ${bisher} zu Nr. ${e.nr}`}${sinkt.length ? `; ${bereich(sinkt)} um eins nach hinten` : ''}${steigt.length ? `; ${bereich(steigt)} um eins nach vorne` : ''}.`)
  }
  return teile.length ? teile.join('\n\n') : null
}
