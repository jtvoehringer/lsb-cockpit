import { describe, expect, it } from 'vitest'
import { ibanFormatiert, ibanGueltig } from '../einstellungen'
import { nummer, offeneSitzungen, positionsBetrag, summe, type Honorarnote } from './honorarnoten'

describe('Honorarnoten', () => {
  it('Nummer, Positionsbetrag und Summe ohne Rundungsfehler', () => {
    expect(nummer(2026, 7)).toBe('2026-0007')
    expect(positionsBetrag(1.8, 90)).toBe(162)
    expect(positionsBetrag(1, 0.1)).toBe(0.1)
    expect(summe([{ datum: '', text: '', einheiten: 1, satz: 0.1, betrag: 0.1 }, { datum: '', text: '', einheiten: 1, satz: 0.2, betrag: 0.2 }])).toBe(0.3)
  })
  it('offene Sitzungen: nur abgeschlossen, nur diese Akte, stornierte Noten geben Sitzungen wieder frei', () => {
    const s = [
      { id: 's1', akte_id: 'a', protokoll_status: 'abgeschlossen' },
      { id: 's2', akte_id: 'a', protokoll_status: 'abgeschlossen' },
      { id: 's3', akte_id: 'a', protokoll_status: 'entwurf' },
      { id: 's4', akte_id: 'b', protokoll_status: 'abgeschlossen' },
      { id: 's5', akte_id: 'a', protokoll_status: 'abgeschlossen' },
    ]
    const n = [
      { sitzung_ids: ['s1'], status: 'offen' },
      { sitzung_ids: ['s5'], status: 'storniert' },
    ] as Honorarnote[]
    expect(offeneSitzungen(s, n, 'a').map((x) => x.id)).toEqual(['s2', 's5'])
  })
  it('IBAN-Prüfziffer', () => {
    expect(ibanGueltig('AT61 1904 3002 3457 3201')).toBe(true)
    expect(ibanGueltig('AT61 1904 3002 3457 3202')).toBe(false)
    expect(ibanGueltig('DE89370400440532013000')).toBe(true)
    expect(ibanGueltig('xx')).toBe(false)
    expect(ibanFormatiert('at611904300234573201')).toBe('AT61 1904 3002 3457 3201')
  })
})
