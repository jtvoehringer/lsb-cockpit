import { describe, expect, it } from 'vitest'
import { ausschnitt, begriffe, trifft } from './suche'

describe('Suche in Protokollen', () => {
  it('teilt in Begriffe, Anführungszeichen = genauer Ausdruck', () => {
    expect(begriffe('  Konflikt  Team ')).toEqual(['konflikt', 'team'])
    expect(begriffe('"am Arbeitsplatz" Schlaf')).toEqual(['am arbeitsplatz', 'schlaf'])
    expect(begriffe('')).toEqual([])
  })
  it('alle Begriffe müssen vorkommen, Groß/Klein und Umlaute egal', () => {
    const t = 'Konflikt am Arbeitsplatz,\nSchlafprobleme seit Wochen; Gespräch mit Teamleitung'
    expect(trifft(t, begriffe('konflikt schlaf'))).toBe(true)
    expect(trifft(t, begriffe('konflikt urlaub'))).toBe(false)
    expect(trifft(t, begriffe('GESPRACH'))).toBe(true)
    expect(trifft(t, begriffe('"am arbeitsplatz"'))).toBe(true)
    expect(trifft(t, begriffe('"arbeitsplatz am"'))).toBe(false)
    expect(trifft(t, [])).toBe(true)
  })
  it('Ausschnitt rund um den ersten Treffer mit Originalschreibweise', () => {
    const t = 'Anfang. ' + 'x'.repeat(100) + ' Die Klientin schildert Schlafprobleme.'
    const a = ausschnitt(t, begriffe('schlaf'), 10)!
    expect(a[1]).toBe('Schlaf')
    expect(a[0].startsWith('… ')).toBe(true)
    expect(a[2]).toBe('probleme.')
    expect(ausschnitt('Gespräch', begriffe('gesprach'))).toEqual(['', 'Gespräch', ''])
    expect(ausschnitt('nichts', begriffe('team'))).toBeNull()
  })
})
