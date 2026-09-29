import { describe, expect, it } from 'vitest'
import { gueltigeEinwilligung, pruefeStammdaten, type StammdatenInhalt } from './stammdaten'

const s = (einwilligungen: StammdatenInhalt['einwilligungen'], mehr: Partial<StammdatenInhalt> = {}): StammdatenInhalt => ({ einwilligungen, ...mehr })

describe('Einwilligungen', () => {
  it('gültig ab Erteilung, ungültig nach Widerruf', () => {
    const x = s([{ id: '1', art: 'datenschutz', erteilt_am: '2026-09-01', widerrufen_am: '2026-10-15' }])
    expect(gueltigeEinwilligung(x, 'datenschutz', '2026-08-31')).toBeNull()
    expect(gueltigeEinwilligung(x, 'datenschutz', '2026-09-01')).toBe('2026-09-01')
    expect(gueltigeEinwilligung(x, 'datenschutz', '2026-10-15')).toBeNull()
    expect(gueltigeEinwilligung(x, 'email', '2026-09-10')).toBeNull()
  })

  it('neue Einwilligung nach Widerruf gilt wieder', () => {
    const x = s([
      { id: '1', art: 'datenschutz', erteilt_am: '2026-01-10', widerrufen_am: '2026-03-01' },
      { id: '2', art: 'datenschutz', erteilt_am: '2026-04-02' },
    ])
    expect(gueltigeEinwilligung(x, 'datenschutz', '2026-05-01')).toBe('2026-04-02')
    expect(gueltigeEinwilligung(x, 'datenschutz', '2026-03-15')).toBeNull()
  })

  it('Prüfung: Geburtsjahr, E-Mail, Widerruf vor Erteilung, Minderjährige', () => {
    expect(pruefeStammdaten(s([]))).toEqual([])
    const f = pruefeStammdaten(s([{ id: '1', art: 'vereinbarung', erteilt_am: '2026-05-02', widerrufen_am: '2026-05-01' }], { geburtsjahr: '85', email: 'x@', minderjaehrig: true }))
    expect(f).toHaveLength(4)
  })
})
