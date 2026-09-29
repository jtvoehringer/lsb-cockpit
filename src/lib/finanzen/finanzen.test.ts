import { describe, expect, it } from 'vitest'
import { betragAusText, jahresuebersicht, MONATE } from './modell'

describe('Finanzen', () => {
  it('liest Beträge in österreichischer und technischer Schreibweise', () => {
    expect(betragAusText('1.234,56')).toBe(1234.56)
    expect(betragAusText('90')).toBe(90)
    expect(betragAusText('12,5')).toBe(12.5)
    expect(betragAusText('€ 80,00')).toBe(80)
    expect(betragAusText('1234.56')).toBe(1234.56)
    expect(betragAusText('0')).toBeNull()
    expect(betragAusText('-5')).toBeNull()
    expect(betragAusText('12,345')).toBeNull()
    expect(betragAusText('abc')).toBeNull()
  })
  it('Jahresübersicht rechnet ohne Rundungsfehler', () => {
    const u = jahresuebersicht([
      { monat: 1, art: 'einnahme', kategorie_id: 'h', summe: 0.1, anzahl: 1 },
      { monat: 1, art: 'einnahme', kategorie_id: 'h', summe: 0.2, anzahl: 1 },
      { monat: 3, art: 'ausgabe', kategorie_id: 'm', summe: 450, anzahl: 1 },
      { monat: 12, art: 'einnahme', kategorie_id: 'h', summe: 1200.55, anzahl: 3 },
    ])
    expect(u.einnahmen).toBe(1200.85)
    expect(u.ausgaben).toBe(450)
    expect(u.ueberschuss).toBe(750.85)
    expect(u.monate[0].einnahmen).toBe(0.3)
    expect(u.monate[2].ueberschuss).toBe(-450)
    expect(u.kategorien.get('h')).toBe(1200.85)
    expect(MONATE[0]).toBe('Jänner')
  })
})
