// Pseudonymisierungs-Check (F-15): findet vor dem Abschließen identifizierende Angaben im Protokolltext.
// Läuft ausschließlich im Browser; Namen kommen aus dem entschlüsselten Register und den Stammdaten.
// Reine Funktionen ohne Datenbank und Krypto – gut testbar.

export type TrefferArt = 'name' | 'email' | 'telefon' | 'datum' | 'adresse' | 'iban' | 'nummer'
export type Treffer = { feld: string; art: TrefferArt; text: string; start: number; ende: number; umfeld: string }

export const TREFFER_TITEL: Record<TrefferArt, string> = {
  name: 'Name aus dem Register oder den Stammdaten',
  email: 'E-Mail-Adresse',
  telefon: 'Telefonnummer',
  datum: 'mögliches Geburtsdatum',
  adresse: 'Adresse',
  iban: 'Kontonummer (IBAN)',
  nummer: 'lange Nummer (z. B. Sozialversicherung)',
}

// Häufige Wörter und Namensbestandteile, die allein keinen Personenbezug herstellen
const STOPP = new Set(['von', 'van', 'der', 'die', 'das', 'den', 'und', 'mit', 'bei', 'zum', 'zur', 'frau', 'herr', 'dr', 'mag', 'ing', 'fiktiv', 'test'])

/** Zerlegt Namen in prüfbare Bestandteile (mind. 3 Buchstaben, ohne Füllwörter), ohne Doppelte. */
export function namensTeile(namen: (string | undefined | null)[]): string[] {
  const teile = new Set<string>()
  for (const n of namen) {
    for (const t of (n ?? '').split(/[\s,;()/.\-–]+/u)) {
      const w = t.trim()
      if (w.length >= 3 && /\p{L}/u.test(w) && !STOPP.has(w.toLowerCase())) teile.add(w)
    }
  }
  return [...teile].sort((a, b) => b.length - a.length)
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function umfeld(text: string, start: number, ende: number) {
  const a = Math.max(0, start - 30), e = Math.min(text.length, ende + 30)
  return (a > 0 ? '…' : '') + text.slice(a, e).replace(/\s+/g, ' ') + (e < text.length ? '…' : '')
}

/** Prüft alle Felder; Treffer sind nach Feld und Position sortiert und überlappen nicht. */
export function pruefeText(felder: Record<string, string | undefined>, namen: string[], jahr = new Date().getFullYear()): Treffer[] {
  const muster: [TrefferArt, RegExp, ((m: RegExpExecArray) => boolean)?][] = [
    ['email', /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.\p{L}{2,}/gu],
    ['iban', /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z\d]{4}){3,7}(?:[ ]?[A-Z\d]{1,4})?\b/g],
    ['adresse', /[\p{L}ß-]*(?:straße|strasse|str\.|gasse|weg|platz|allee|ring|zeile|promenade|kai)\s*\d+[a-z]?(?:\s*\/\s*\d+)*/giu],
    ['datum', /\b(\d{1,2})\.\s?(\d{1,2})\.\s?((?:19|20)\d{2})\b/g, (m) => Number(m[3]) <= jahr - 10],
    ['telefon', /(?:\+|\b0)[\d ()/-]{6,}\d/g, (m) => m[0].replace(/\D/g, '').length >= 8],
    ['nummer', /\b\d{4}\s?\d{6}\b/g],
  ]
  const teile = namensTeile(namen)
  if (teile.length) muster.unshift(['name', new RegExp(`(?<!\\p{L})(?:${teile.map(escape).join('|')})(?:s|'s)?(?!\\p{L})`, 'giu')])

  const out: Treffer[] = []
  for (const [feld, text] of Object.entries(felder)) {
    if (!text) continue
    const belegt: [number, number][] = []
    for (const [art, re, gilt] of muster) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(text))) {
        const start = m.index, ende = m.index + m[0].length
        if (!m[0].trim() || (gilt && !gilt(m))) continue
        if (belegt.some(([a, e]) => start < e && ende > a)) continue
        belegt.push([start, ende])
        out.push({ feld, art, text: m[0].trim(), start, ende, umfeld: umfeld(text, start, ende) })
      }
    }
  }
  return out.sort((a, b) => a.feld.localeCompare(b.feld) || a.start - b.start)
}
