// Protokoll-Modell: Arten, Felder (WKO-Gliederung), Zeiten und Einheiten, Chiffre. Ohne Datenbank und Krypto – gut testbar.

export const EINHEIT_MIN = 50

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

/** Arbeitseinheiten zu 50 Minuten, auf zwei Stellen gerundet */
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

export const leererInhalt = (): Inhalt => ({ felder: {}, supervision: false })
