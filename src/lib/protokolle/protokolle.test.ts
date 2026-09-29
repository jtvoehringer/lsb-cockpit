import { describe, expect, it } from 'vitest'
import { CHIFFRE_MUSTER, einheiten, minuten, naechsteChiffre } from './modell'

describe('Zeiten und Einheiten', () => {
  it('rechnet Dauer und Einheiten zu 50 Minuten', () => {
    expect(minuten('17:00', '18:30')).toBe(90)
    expect(einheiten(90)).toBe(1.8)
    expect(einheiten(50)).toBe(1)
    expect(minuten('23:30', '00:20')).toBe(50) // über Mitternacht
    expect(minuten('', '10:00')).toBe(0)
    expect(minuten('ab:cd', '10:00')).toBe(0)
  })
})

describe('Chiffre', () => {
  it('Format K-JJ-NNNN-XX, fortlaufend je Jahr, ohne I und O', () => {
    const c1 = naechsteChiffre([], 2026)
    expect(c1).toMatch(CHIFFRE_MUSTER)
    expect(c1.startsWith('K-26-0001-')).toBe(true)
    expect(naechsteChiffre(['K-26-0001-AB', 'K-26-0007-XY', 'K-25-0042-CD'], 2026).startsWith('K-26-0008-')).toBe(true)
    expect(naechsteChiffre(['K-25-0042-CD'], 2027).startsWith('K-27-0001-')).toBe(true)
    for (let i = 0; i < 500; i++) expect(naechsteChiffre([], 2026).slice(-2)).not.toMatch(/[IO]/)
  })
  it('Testpraxis: Präfix T-', () => {
    expect(naechsteChiffre(['T-K-26-0003-AB'], 2026, true).startsWith('T-K-26-0004-')).toBe(true)
  })
})
