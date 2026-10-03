import { describe, expect, it } from 'vitest'
import { CHIFFRE_MUSTER, chiffreJahr, einheiten, minuten, nameTeilen, naechsteChiffre, pruefeDatum, vollerName } from './modell'

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

describe('Nachträge aus der Ausbildungszeit (ab 2024)', () => {
  const heute = new Date(2026, 8, 30)
  it('Chiffre mit Jahr des Erstkontakts, Zählung je Jahr getrennt', () => {
    const vorhandene = ['K-26-0001-AB', 'K-24-0002-CD']
    expect(naechsteChiffre(vorhandene, 2024).startsWith('K-24-0003-')).toBe(true)
    expect(naechsteChiffre(vorhandene, 2025).startsWith('K-25-0001-')).toBe(true)
    expect(chiffreJahr('K-25-0001-XY')).toBe(2025)
    expect(chiffreJahr('T-K-24-0001-XY')).toBe(2024)
    expect(chiffreJahr('unsinn')).toBeNull()
  })
  it('Datum: ab 2024, nicht in künftigen Jahren', () => {
    expect(pruefeDatum('2024-01-01', heute)).toBeNull()
    expect(pruefeDatum('2025-06-15', heute)).toBeNull()
    expect(pruefeDatum('2026-12-31', heute)).toBeNull()
    expect(pruefeDatum('2023-12-31', heute)).toMatch(/ab 2024/)
    expect(pruefeDatum('2027-01-01', heute)).toMatch(/künftigen/)
    expect(pruefeDatum('', heute)).toMatch(/gültiges/)
  })
})

describe('Vorname / Nachname', () => {
  it('teilt „Vorname Nachname“ – letztes Wort ist der Nachname', () => {
    expect(nameTeilen('Anna Huber')).toEqual({ vorname: 'Anna', nachname: 'Huber' })
    expect(nameTeilen('  Anna  Maria   Huber-Meier ')).toEqual({ vorname: 'Anna Maria', nachname: 'Huber-Meier' })
    expect(nameTeilen('Huber')).toEqual({ vorname: '', nachname: 'Huber' })
    expect(nameTeilen('')).toEqual({ vorname: '', nachname: '' })
  })
  it('setzt den vollen Namen zusammen', () => {
    expect(vollerName(' Anna ', 'Huber')).toBe('Anna Huber')
    expect(vollerName('', 'Huber')).toBe('Huber')
    expect(vollerName(undefined, undefined)).toBe('')
  })
})
