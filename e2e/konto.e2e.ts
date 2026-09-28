// Ende-zu-Ende-Test gegen das echte Supabase-Projekt mit einem FIKTIVEN Testkonto (nie mit echten Daten).
// Ablauf wie im Browser: Einrichtungscode → TOTP → Schlüsselbund → Passwortwechsel → Neuanmeldung → Entsperren.
// Prüft zusätzlich die RLS-Regeln (ohne AAL2 kein Zugriff, fremde Einträge unmöglich, nur Chiffretext gespeichert).
// Aufruf: E2E_EMAIL=… E2E_EINRICHTUNGSCODE=… npx vitest run --config vitest.e2e.config.ts
import { createHmac } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { aad, anmeldeGeheimnis, entschluessele, schluesselbundEinrichten, schluesselbundOeffnen, verschluessele, type KdfParameter, type SchluesselbundEintrag } from '../src/lib/crypto/kern'

const URL = 'https://mndfkacmmjhvkhvxgbkz.supabase.co'
const KEY = 'sb_publishable_VhVvvv_I1sh1LJrPJP_9Pw_5tzjZPLw'
const EMAIL = process.env.E2E_EMAIL!
const CODE = process.env.E2E_EINRICHTUNGSCODE!
const PASSPHRASE = 'Wolke Tanne Kiesel Brücke Laterne ' + Date.now()

const neu = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

function totp(base32: string, zeit = Date.now()) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of base32.replace(/=+$/, '').toUpperCase()) bits += A.indexOf(c).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const zaehler = Buffer.alloc(8)
  zaehler.writeBigUInt64BE(BigInt(Math.floor(zeit / 30000)))
  const h = createHmac('sha1', key).update(zaehler).digest()
  const o = h[h.length - 1] & 15
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

async function ladeBund(sb: SupabaseClient): Promise<SchluesselbundEintrag[]> {
  const { data, error } = await sb.from('schluesselbund').select('art, version, verpackt, kdf')
  if (error) throw error
  return (data ?? []).map((z) => ({ ...z, kdf: z.kdf as KdfParameter | null }))
}

describe.skipIf(!EMAIL || !CODE)('Konto-Einrichtung und Anmeldung (Supabase, fiktives Testkonto)', () => {
  let totpGeheimnis = ''
  let userId = ''

  it('Einrichtung: Code-Anmeldung, RLS ohne AAL2, TOTP, Schlüsselbund, Passwortwechsel', async () => {
    const sb = neu()
    const { data: login, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: CODE })
    expect(error).toBeNull()
    userId = login.user!.id

    // Ohne zweiten Faktor (AAL1): nichts lesbar, nichts schreibbar
    expect((await sb.from('benutzer').select('*')).data).toEqual([])
    expect((await sb.from('schluesselbund').insert({ user_id: userId, art: 'master', version: 1, verpackt: 'x' })).error).not.toBeNull()

    const { data: enroll, error: e2 } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'E2E' })
    expect(e2).toBeNull()
    totpGeheimnis = enroll!.totp.secret
    const { error: e3 } = await sb.auth.mfa.challengeAndVerify({ factorId: enroll!.id, code: totp(totpGeheimnis) })
    expect(e3).toBeNull()

    // AAL2: eigene Zeile sichtbar
    expect((await sb.from('benutzer').select('user_id')).data).toEqual([{ user_id: userId }])

    const { eintraege } = await schluesselbundEinrichten(PASSPHRASE)
    const { error: e4 } = await sb.from('schluesselbund').insert(eintraege.map((e) => ({ ...e, user_id: userId })))
    expect(e4).toBeNull()

    // Fremde user_id wird abgelehnt
    expect((await sb.from('schluesselbund').insert({ user_id: '00000000-0000-0000-0000-000000000000', art: 'master', version: 9, verpackt: 'x' })).error).not.toBeNull()
    // Nur anhängen: Ändern und Löschen sind nicht erlaubt
    await sb.from('schluesselbund').update({ verpackt: 'manipuliert' }).eq('user_id', userId)
    await sb.from('schluesselbund').delete().eq('user_id', userId)
    const bund = await ladeBund(sb)
    expect(bund).toHaveLength(5)
    expect(bund.every((e) => e.verpackt !== 'manipuliert')).toBe(true)

    const { error: e5 } = await sb.auth.updateUser({ password: await anmeldeGeheimnis(PASSPHRASE, EMAIL) })
    expect(e5).toBeNull()
    await sb.auth.signOut()
  }, 120_000)

  it('Anmeldung mit Passphrase + TOTP, Tresor öffnen, verschlüsseln; Einrichtungscode gilt nicht mehr', async () => {
    const alt = neu()
    expect((await alt.auth.signInWithPassword({ email: EMAIL, password: CODE })).error).not.toBeNull()

    const sb = neu()
    expect((await sb.auth.signInWithPassword({ email: EMAIL, password: await anmeldeGeheimnis(PASSPHRASE, EMAIL) })).error).toBeNull()
    const { data: faktoren } = await sb.auth.mfa.listFactors()
    const faktor = faktoren!.totp.find((f) => f.status === 'verified')!
    await new Promise((r) => setTimeout(r, 31_000)) // neuer TOTP-Zeitschritt (Wiederverwendung wird abgelehnt)
    expect((await sb.auth.mfa.challengeAndVerify({ factorId: faktor.id, code: totp(totpGeheimnis) })).error).toBeNull()

    const tresor = await schluesselbundOeffnen(await ladeBund(sb), PASSPHRASE)
    const z = aad('selbsttest', 'e2e', 'inhalt')
    expect(await entschluessele(tresor.zone_b, await verschluessele(tresor.zone_b, 'geheim', z), z)).toBe('geheim')
    await expect(schluesselbundOeffnen(await ladeBund(sb), PASSPHRASE + 'x')).rejects.toThrow()

    // Audit-Eintrag nur für die eigene Praxis
    const { data: b } = await sb.from('benutzer').select('praxis_id').single()
    expect((await sb.from('audit_log').insert({ praxis_id: b!.praxis_id, ereignis: 'e2e-test' })).error).toBeNull()
    expect((await sb.from('audit_log').insert({ praxis_id: '00000000-0000-0000-0000-000000000000', ereignis: 'e2e-test' })).error).not.toBeNull()
    await sb.auth.signOut()
  }, 120_000)

  it('Ohne Anmeldung (anon): kein Zugriff auf irgendeine Tabelle', async () => {
    const sb = neu()
    for (const t of ['praxis', 'benutzer', 'schluesselbund', 'audit_log']) {
      const { data, error } = await sb.from(t).select('*')
      expect(error !== null || (data ?? []).length === 0).toBe(true)
    }
  })
})
