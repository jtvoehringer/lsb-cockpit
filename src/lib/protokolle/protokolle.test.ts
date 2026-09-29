import { describe, expect, it } from 'vitest'
import { utf8, zuBase64 } from '../crypto/kodierung'
import { CHIFFRE_MUSTER, einheiten, minuten, naechsteChiffre } from './modell'
import { ausSicherung, FalschePrototypPassphrase, oeffnePrototyp, plane, type PrototypProtokoll } from './prototyp'

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

// Sicherung genau wie der Diktat-Prototyp sie erzeugt (prototyp/store.js)
async function prototypSicherung(passphrase: string, protokolle: PrototypProtokoll[]) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const basis = await crypto.subtle.importKey('raw', utf8(passphrase), 'PBKDF2', false, ['deriveKey'])
  const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 1000 }, basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
  const box = async (text: string, zusatz: string) => {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    return { iv: zuBase64(iv), ct: zuBase64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: utf8(zusatz) }, k, utf8(text))) }
  }
  return {
    format: 'lsb-protokolle-sicherung', version: 1, kdf: { name: 'PBKDF2-SHA256', salt: zuBase64(salt), iterations: 1000 },
    verifier: await box('lsb-protokolle-v1', 'verifier'),
    records: await Promise.all(protokolle.map(async (p) => ({ id: p.id, ...(await box(JSON.stringify(p), 'protokoll:' + p.id)) }))),
  }
}

const beispiel = (id: string, kuerzel: string, nr: number): PrototypProtokoll => ({
  id, nr, art: 'erst', kuerzel, datum: '2026-09-20', beginn: '17:00', ende: '18:30', vorbereitungMin: 15, nachbereitungMin: 15,
  felder: { anliegen: 'Fiktiver Testinhalt' }, prozessAbgeschlossen: false, supervision: false, status: 'abgeschlossen',
  erstelltAm: '2026-09-20T16:00:00Z', geaendertAm: '2026-09-20T17:00:00Z', abgeschlossenAm: '2026-09-20T17:00:00Z', versionen: [],
})

describe('Übernahme aus dem Diktat-Prototyp', () => {
  it('öffnet eine Prototyp-Sicherung mit der richtigen Passphrase', async () => {
    const q = ausSicherung(await prototypSicherung('alte Passphrase 123', [beispiel('a', 'TE01', 1), beispiel('b', 'TE02', 2)]))
    const p = await oeffnePrototyp(q, 'alte Passphrase 123')
    expect(p.map((x) => x.kuerzel)).toEqual(['TE01', 'TE02'])
    expect(p[0].felder.anliegen).toBe('Fiktiver Testinhalt')
  })
  it('falsche Passphrase und fremde Dateien werden abgelehnt', async () => {
    const q = ausSicherung(await prototypSicherung('richtig richtig', [beispiel('a', 'TE01', 1)]))
    await expect(oeffnePrototyp(q, 'falsch')).rejects.toBeInstanceOf(FalschePrototypPassphrase)
    expect(() => ausSicherung({ format: 'etwas anderes' })).toThrow()
  })
  it('vertauschte Datensätze werden erkannt (AAD bindet an die ID)', async () => {
    const s = await prototypSicherung('richtig richtig', [beispiel('a', 'TE01', 1), beispiel('b', 'TE02', 2)])
    const q = ausSicherung({ ...s, records: [{ ...s.records[0], id: 'b' }] })
    await expect(oeffnePrototyp(q, 'richtig richtig')).rejects.toThrow()
  })
  it('Plan: je Kürzel eine Akte, bereits Übernommenes wird übersprungen', () => {
    const p = [beispiel('a', 'TE01', 1), beispiel('b', 'TE01', 2), beispiel('c', ' TE02 ', 3), beispiel('d', '', 4)]
    const plan = plane(p, new Set(['a']))
    expect(plan.uebersprungen).toBe(1)
    expect(plan.neu.map((x) => x.id)).toEqual(['b', 'c', 'd'])
    expect(plan.kuerzel).toEqual(['(ohne Kürzel)', 'TE01', 'TE02'])
  })
})
