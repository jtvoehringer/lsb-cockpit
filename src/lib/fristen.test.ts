import { describe, expect, it } from 'vitest'
import { berechneAufbewahrung, FRISTEN_STANDARD, plusJahre, pruefeFristEinstellungen } from './fristen'

describe('Aufbewahrungsfristen', () => {
  it('Standard 3 Jahre ab Abschluss, mit Zustimmung 7 Jahre', () => {
    expect(berechneAufbewahrung({ abschluss: '2026-10-15' })).toMatchObject({ bis: '2029-10-15', jahre: 3, grund: 'standard' })
    expect(berechneAufbewahrung({ abschluss: '2026-10-15', zustimmung: true })).toMatchObject({ bis: '2033-10-15', jahre: 7, grund: 'zustimmung' })
  })

  it('Minderjährige: Beginn mit Volljährigkeit (31.12. des Jahres), nur wenn später als der Abschluss', () => {
    expect(berechneAufbewahrung({ abschluss: '2026-10-15', minderjaehrig: true, geburtsjahr: '2012' })).toMatchObject({ beginn: '2030-12-31', bis: '2033-12-31', ab_volljaehrigkeit: true })
    expect(berechneAufbewahrung({ abschluss: '2026-10-15', minderjaehrig: true, geburtsjahr: '2000' })).toMatchObject({ bis: '2029-10-15', ab_volljaehrigkeit: false })
    expect(() => berechneAufbewahrung({ abschluss: '2026-10-15', minderjaehrig: true })).toThrow('Geburtsjahr')
    expect(berechneAufbewahrung({ abschluss: '2026-10-15', minderjaehrig: true }, { ...FRISTEN_STANDARD, minderjaehrige_ab_volljaehrigkeit: false }).bis).toBe('2029-10-15')
  })

  it('geänderte Einstellungen und 29. Februar', () => {
    expect(berechneAufbewahrung({ abschluss: '2026-01-01' }, { ...FRISTEN_STANDARD, standard_jahre: 5 }).bis).toBe('2031-01-01')
    expect(plusJahre('2028-02-29', 3)).toBe('2031-02-28')
    expect(plusJahre('2028-02-29', 4)).toBe('2032-02-29')
  })

  it('Einstellungen werden geprüft', () => {
    expect(pruefeFristEinstellungen(FRISTEN_STANDARD)).toEqual([])
    expect(pruefeFristEinstellungen({ standard_jahre: 0, zustimmung_jahre: 40, volljaehrig_mit: 30, minderjaehrige_ab_volljaehrigkeit: true })).toHaveLength(3)
  })
})
