// Ende-zu-Ende: Support-Zugang (ICP) – nur mit befristeter Freigabe der Beraterin, technisch ohne Inhalte.
// Fiktive Testkonten (siehe .env.test.local). Richtet beim ersten Lauf das Support-Konto ein (TOTP + Passwort).
import { createHmac } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { anmeldeGeheimnis } from '../src/lib/crypto/kern'

const URL = 'https://mndfkacmmjhvkhvxgbkz.supabase.co'
const KEY = 'sb_publishable_VhVvvv_I1sh1LJrPJP_9Pw_5tzjZPLw'
const E = process.env
const neu = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

function totp(base32: string, versatz = 0) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of base32.toUpperCase().replace(/=+$/, '')) bits += A.indexOf(c).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const z = Buffer.alloc(8); z.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + versatz))
  const h = createHmac('sha1', key).update(z).digest(), o = h[h.length - 1] & 15
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

async function beraterin(): Promise<SupabaseClient> {
  const sb = neu()
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL!, password: await anmeldeGeheimnis(E.E2E_PASSPHRASE!, E.E2E_EMAIL!) })).error).toBeNull()
  const { data: f } = await sb.auth.mfa.listFactors()
  expect((await sb.auth.mfa.challengeAndVerify({ factorId: f!.totp[0].id, code: totp(E.E2E_TOTP_GEHEIMNIS!) })).error).toBeNull()
  return sb
}

const zeilen = async (sb: SupabaseClient, t: string) => ((await sb.from(t).select('*')).data ?? []).length

describe.skipIf(!E.E2E_SUPPORT_EMAIL || !E.E2E_EMAIL)('Support-Zugang (fiktive Testkonten)', () => {
  it('ohne Freigabe nichts, mit Freigabe nur Chiffren/Termine/Audit, nach Beenden wieder nichts', async () => {
    // Support-Konto einrichten (wie /einrichten): Code-Anmeldung, TOTP, Passwort = Anmelde-Geheimnis
    const support = neu()
    const passphrase = 'Support Test Passphrase Wolke 77'
    expect((await support.auth.signInWithPassword({ email: E.E2E_SUPPORT_EMAIL!, password: E.E2E_SUPPORT_EINRICHTUNGSCODE! })).error).toBeNull()
    const { data: enr, error: e1 } = await support.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Support E2E' })
    expect(e1).toBeNull()
    expect((await support.auth.mfa.challengeAndVerify({ factorId: enr!.id, code: totp(enr!.totp.secret) })).error).toBeNull()
    expect((await support.auth.updateUser({ password: await anmeldeGeheimnis(passphrase, E.E2E_SUPPORT_EMAIL!) })).error).toBeNull()
    expect((await support.from('benutzer').select('rolle').single()).data!.rolle).toBe('support')

    // Ohne Freigabe: nichts
    for (const t of ['akte', 'sitzung', 'praxis', 'audit_log', 'register_eintrag', 'protokoll_version', 'fin_buchung', 'fin_honorarnote', 'schluesselbund'])
      expect(await zeilen(support, t)).toBe(0)
    // Support kann sich nicht selbst freigeben
    const { data: b } = await support.from('benutzer').select('praxis_id').single()
    expect((await support.from('support_freigabe').insert({ praxis_id: b!.praxis_id, gueltig_bis: new Date(Date.now() + 3600e3).toISOString() })).error).not.toBeNull()

    // Beraterin gibt 1 Stunde frei
    const ber = await beraterin()
    const { data: fg, error: e2 } = await ber.from('support_freigabe').insert({ praxis_id: b!.praxis_id, gueltig_bis: new Date(Date.now() + 3600e3).toISOString() }).select('id').single()
    expect(e2).toBeNull()
    // Maximal 8 Tage
    expect((await ber.from('support_freigabe').insert({ praxis_id: b!.praxis_id, gueltig_bis: new Date(Date.now() + 30 * 86400e3).toISOString() })).error).not.toBeNull()

    // Mit Freigabe: Chiffren, Termine, Einstellungen, Audit ja – Inhalte, Register, Finanzen, Schlüssel nein
    expect(await zeilen(support, 'akte')).toBeGreaterThan(0)
    expect(await zeilen(support, 'sitzung')).toBeGreaterThan(0)
    expect(await zeilen(support, 'praxis')).toBe(1)
    for (const t of ['register_eintrag', 'protokoll_version', 'fin_buchung', 'fin_beleg', 'fin_honorarnote', 'fin_kategorie', 'schluesselbund'])
      expect(await zeilen(support, t)).toBe(0)
    // Schreiben geht nicht (außer eigenem Audit-Eintrag)
    expect((await support.from('akte').insert({ praxis_id: b!.praxis_id, chiffre: 'T-K-26-9998-AB' })).error).not.toBeNull()
    expect((await support.from('audit_log').insert({ praxis_id: b!.praxis_id, ereignis: 'support_zugriff', objekt: 'E2E' })).error).toBeNull()
    expect((await support.from('support_freigabe').update({ beendet_am: new Date().toISOString() }).eq('id', fg!.id).select()).data ?? []).toEqual([])

    // Beraterin beendet → wieder nichts
    expect((await ber.from('support_freigabe').update({ beendet_am: new Date().toISOString() }).eq('id', fg!.id)).error).toBeNull()
    for (const t of ['akte', 'sitzung', 'praxis', 'audit_log']) expect(await zeilen(support, t)).toBe(0)

    // Beraterin sieht den Support-Eintrag im Audit
    const { data: audit } = await ber.from('audit_log').select('ereignis, objekt').eq('objekt', 'E2E')
    expect(audit!.length).toBeGreaterThan(0)
    await support.auth.signOut({ scope: 'local' }); await ber.auth.signOut({ scope: 'local' })
  }, 90_000)
})
