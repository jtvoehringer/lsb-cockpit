// Ende-zu-Ende: Zugriffsschutz des Protokoll-Moduls gegen das echte Supabase-Projekt (fiktives Testkonto, bereits eingerichtet).
// Aufruf: E2E_EMAIL, E2E_PASSPHRASE, E2E_TOTP_GEHEIMNIS setzen (siehe .env.test.local), dann
//   npx vitest run --config vitest.e2e.config.ts e2e/protokolle.e2e.ts
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { anmeldeGeheimnis } from '../src/lib/crypto/kern'

const URL = 'https://mndfkacmmjhvkhvxgbkz.supabase.co'
const KEY = 'sb_publishable_VhVvvv_I1sh1LJrPJP_9Pw_5tzjZPLw'
const { E2E_EMAIL: EMAIL, E2E_PASSPHRASE: PASS, E2E_TOTP_GEHEIMNIS: TOTP } = process.env

function totp(base32: string) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of base32.toUpperCase()) bits += A.indexOf(c).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const z = Buffer.alloc(8); z.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const h = createHmac('sha1', key).update(z).digest(), o = h[h.length - 1] & 15
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

describe.skipIf(!EMAIL || !PASS || !TOTP)('Protokoll-Modul: Zugriffsschutz (fiktives Testkonto)', () => {
  it('Versionen unveränderlich, abgeschlossene Sitzungen nicht löschbar, fremde Praxis gesperrt, anon ohne Zugriff', async () => {
    const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    expect((await sb.auth.signInWithPassword({ email: EMAIL!, password: await anmeldeGeheimnis(PASS!, EMAIL!) })).error).toBeNull()

    // Ohne zweiten Faktor: keine Protokolldaten
    expect((await sb.from('sitzung').select('id')).data).toEqual([])

    const { data: f } = await sb.auth.mfa.listFactors()
    expect((await sb.auth.mfa.challengeAndVerify({ factorId: f!.totp[0].id, code: totp(TOTP!) })).error).toBeNull()

    const { data: sitzungen } = await sb.from('sitzung').select('id, protokoll_status, praxis_id')
    expect(sitzungen!.length).toBeGreaterThan(0)
    const abgeschlossen = sitzungen!.find((s) => s.protokoll_status === 'abgeschlossen')!

    const { data: v } = await sb.from('protokoll_version').select('id, inhalt_enc').eq('sitzung_id', abgeschlossen.id).limit(1).single()
    // Ändern und Löschen von Versionen: keine Rechte
    expect((await sb.from('protokoll_version').update({ inhalt_enc: 'manipuliert' }).eq('id', v!.id)).error).not.toBeNull()
    await sb.from('protokoll_version').delete().eq('id', v!.id)
    expect((await sb.from('protokoll_version').select('inhalt_enc').eq('id', v!.id).single()).data!.inhalt_enc).toBe(v!.inhalt_enc)

    // Abgeschlossene Sitzung lässt sich nicht löschen
    await sb.from('sitzung').delete().eq('id', abgeschlossen.id)
    expect((await sb.from('sitzung').select('id').eq('id', abgeschlossen.id)).data).toHaveLength(1)

    // Nicht freigegebene Spalten (Chiffre, Herkunft, Praxis) sind nicht änderbar
    expect((await sb.from('akte').update({ chiffre: 'K-99-9999-ZZ' }).eq('praxis_id', abgeschlossen.praxis_id)).error).not.toBeNull()
    expect((await sb.from('sitzung').update({ praxis_id: '00000000-0000-0000-0000-000000000000' }).eq('id', abgeschlossen.id)).error).not.toBeNull()

    // Anlegen für eine fremde Praxis wird abgelehnt
    expect((await sb.from('akte').insert({ praxis_id: '00000000-0000-0000-0000-000000000000', chiffre: 'T-K-26-9999-AB' })).error).not.toBeNull()
    await sb.auth.signOut()

    const anon = createClient(URL, KEY, { auth: { persistSession: false } })
    for (const t of ['akte', 'sitzung', 'protokoll_version', 'register_eintrag']) {
      const { data, error } = await anon.from(t).select('*')
      expect(error !== null || (data ?? []).length === 0).toBe(true)
    }
  }, 60_000)
})
