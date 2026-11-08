import { describe, expect, it } from 'vitest'
import { CHIFFRE_MUSTER, chiffreJahr, einheiten, minuten, nameTeilen, naechsteChiffre, pruefeDatum, vollerName } from './modell'

describe('Zeiten und Einheiten', () => {
  it('rechnet Dauer und Einheiten zu 60 Minuten', () => {
    expect(minuten('17:00', '18:30')).toBe(90)
    expect(einheiten(90)).toBe(1.5)
    expect(einheiten(60)).toBe(1)
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

import { einordnung, einordnungsHinweis, type NrZeile } from './modell'
describe('Nummern nach Beratungsdatum', () => {
  const z = (nr: number, datum: string, beginn: string | null = '10:00'): NrZeile => ({ id: `s${nr}`, nr, datum, beginn, erstellt_am: '2026-11-01T00:00:00Z' })
  const alle = [z(1, '2026-11-01'), z(2, '2026-11-03'), z(3, '2026-11-07')]
  it('neues Protokoll am Ende bekommt die nächste Nummer, nichts verschiebt sich', () => {
    const e = einordnung(alle, '2026-11-08')
    expect(e.nr).toBe(4); expect(e.verschoben).toEqual([]); expect(einordnungsHinweis(e, '08.11.2026')).toBeNull()
  })
  it('Beispiel: 7.11. hat Nr. 3, neues vom 6.11. bekommt Nr. 3, das vom 7.11. wird Nr. 4', () => {
    const e = einordnung(alle, '2026-11-06')
    expect(e.nr).toBe(3); expect(e.verschoben).toEqual([{ alt: 3, neu: 4 }])
    expect(einordnungsHinweis(e, '06.11.2026')).toContain('Nr. 3 rückt um eins nach hinten')
  })
  it('gleicher Tag: Hinweis, neues kommt nach den vorhandenen Gesprächen des Tages', () => {
    const e = einordnung(alle, '2026-11-03')
    expect(e.nr).toBe(3); expect(e.amTag.map((x) => x.nr)).toEqual([2])
    expect(einordnungsHinweis(e, '03.11.2026')).toContain('bereits ein Protokoll (Nr. 2)')
  })
  it('Datum eines vorhandenen Protokolls ändern', () => {
    const e = einordnung(alle, '2026-11-02', '10:00', alle[2])
    expect(e.nr).toBe(2); expect(e.verschoben).toEqual([{ alt: 2, neu: 3 }])
    expect(einordnungsHinweis(e, '02.11.2026', 3)).toContain('von Nr. 3 zu Nr. 2')
    expect(einordnungsHinweis(einordnung(alle, '2026-11-06', '10:00', alle[2]), '06.11.2026', 3)).toBeNull()
  })
})
