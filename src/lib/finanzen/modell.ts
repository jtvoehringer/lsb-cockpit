// Finanzen (Einnahmen-Ausgaben-Rechnung, Kleinunternehmerin – Beträge ohne USt). Reine Logik, ohne Datenbank.

export type FinArt = 'einnahme' | 'ausgabe'
export type Zahlungsart = 'bank' | 'bar' | 'karte'
export const ZAHLUNGSART: Record<Zahlungsart, string> = { bank: 'Bank', bar: 'Bar', karte: 'Karte' }
export const FIN_ART: Record<FinArt, string> = { einnahme: 'Einnahme', ausgabe: 'Ausgabe' }

/** Startkategorien für eine Lebens- und Sozialberatung. E1a-Kennzahlen bewusst leer – mit der Steuerberatung zuordnen. */
export const STANDARD_KATEGORIEN: { name: string; art: FinArt }[] = [
  { name: 'Honorare Einzelberatung', art: 'einnahme' },
  { name: 'Honorare Workshops und Unternehmen', art: 'einnahme' },
  { name: 'Sonstige Einnahmen', art: 'einnahme' },
  { name: 'Raummiete', art: 'ausgabe' },
  { name: 'Supervision und Fortbildung', art: 'ausgabe' },
  { name: 'Fachliteratur und Material', art: 'ausgabe' },
  { name: 'Büro, Software und Geräte', art: 'ausgabe' },
  { name: 'Telefon und Internet', art: 'ausgabe' },
  { name: 'Versicherungen', art: 'ausgabe' },
  { name: 'Sozialversicherung (SVS)', art: 'ausgabe' },
  { name: 'Kammerumlage und Mitgliedsbeiträge', art: 'ausgabe' },
  { name: 'Fahrtkosten', art: 'ausgabe' },
  { name: 'Werbung und Website', art: 'ausgabe' },
  { name: 'Steuerberatung', art: 'ausgabe' },
  { name: 'Bankspesen', art: 'ausgabe' },
  { name: 'Sonstige Ausgaben', art: 'ausgabe' },
]

/** Betrag aus Eingabe „1.234,56“ / „1234.56“ / „12,5“ → Zahl mit zwei Nachkommastellen, sonst null */
export function betragAusText(text: string): number | null {
  const t = text.trim().replace(/\s|€/g, '')
  if (!t) return null
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) return null
  const n = Math.round(Number(norm) * 100) / 100
  return n > 0 && n < 1e10 ? n : null
}

export type Summenzeile = { monat: number; art: FinArt; kategorie_id: string; summe: number; anzahl: number }

/** Jahresübersicht: je Monat Einnahmen/Ausgaben/Überschuss und je Kategorie – Summen in Cent, um Rundungsfehler zu vermeiden */
export function jahresuebersicht(zeilen: Summenzeile[]) {
  const monate = Array.from({ length: 12 }, (_, i) => ({ monat: i + 1, einnahmen: 0, ausgaben: 0 }))
  const kategorien = new Map<string, number>()
  for (const z of zeilen) {
    const cent = Math.round(z.summe * 100)
    const m = monate[z.monat - 1]
    if (z.art === 'einnahme') m.einnahmen += cent; else m.ausgaben += cent
    kategorien.set(z.kategorie_id, (kategorien.get(z.kategorie_id) ?? 0) + cent)
  }
  const ein = monate.reduce((s, m) => s + m.einnahmen, 0), aus = monate.reduce((s, m) => s + m.ausgaben, 0)
  return {
    monate: monate.map((m) => ({ monat: m.monat, einnahmen: m.einnahmen / 100, ausgaben: m.ausgaben / 100, ueberschuss: (m.einnahmen - m.ausgaben) / 100 })),
    kategorien: new Map([...kategorien].map(([k, v]) => [k, v / 100])),
    einnahmen: ein / 100, ausgaben: aus / 100, ueberschuss: (ein - aus) / 100,
  }
}

const eur = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })
export const euro = (n: number) => eur.format(n)
export const MONATE = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
