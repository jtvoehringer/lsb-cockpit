// Ende-zu-Ende: Gesamt-Export mit dem Code der Anwendung erzeugen, prüfen und mit scripts/export-einspielen.mjs
// für eine neue Installation aufbereiten (B-11). Fiktives Testkonto (siehe .env.test.local); schreibt nichts in die Datenbank.
import { execFileSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { anmeldeGeheimnis, schluesselbundOeffnen, type KdfParameter, type SchluesselbundEintrag } from '../src/lib/crypto/kern'
import { erstelleExport, mitClient, pruefeExport } from '../src/lib/sicherung'

const URL = 'https://mndfkacmmjhvkhvxgbkz.supabase.co'
const KEY = 'sb_publishable_VhVvvv_I1sh1LJrPJP_9Pw_5tzjZPLw'
const E = process.env

function totp(base32: string) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of base32.toUpperCase().replace(/=+$/, '')) bits += A.indexOf(c).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const z = Buffer.alloc(8); z.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const h = createHmac('sha1', key).update(z).digest(), o = h[h.length - 1] & 15
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

describe.skipIf(!E.E2E_EMAIL || !E.E2E_PASSPHRASE || !E.E2E_TOTP_GEHEIMNIS)('Gesamt-Export und Wiederherstellung (fiktives Testkonto)', () => {
  it('Export ist verschlüsselt, prüfbar und lässt sich mit der Passphrase für eine neue Installation aufbereiten', async () => {
    const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL!, password: await anmeldeGeheimnis(E.E2E_PASSPHRASE!, E.E2E_EMAIL!) })).error).toBeNull()
    const { data: f } = await sb.auth.mfa.listFactors()
    expect((await sb.auth.mfa.challengeAndVerify({ factorId: f!.totp[0].id, code: totp(E.E2E_TOTP_GEHEIMNIS!) })).error).toBeNull()

    const { data: bund } = await sb.from('schluesselbund').select('art, version, verpackt, kdf')
    const t = await schluesselbundOeffnen((bund ?? []).map((z) => ({ ...z, kdf: z.kdf as KdfParameter | null })) as SchluesselbundEintrag[], E.E2E_PASSPHRASE!)

    mitClient(sb)
    const blob = await erstelleExport(t.zone_a)
    const text = await blob.text()
    expect(text).not.toMatch(/Mustermann|Testfrau|Testberaterin|K-26-/) // auch Metadaten nicht lesbar
    const uebersicht = await pruefeExport(t.zone_a, new File([text], 'export.json'))
    expect(uebersicht.tabellen.akte).toBeGreaterThan(0)

    const ordner = mkdtempSync(join(tmpdir(), 'lsb-wiederherstellung-'))
    const datei = join(ordner, 'export.json'); writeFileSync(datei, text)
    const praxisNeu = randomUUID(), benutzerNeu = randomUUID()
    execFileSync(process.execPath, ['scripts/export-einspielen.mjs', datei, '--praxis', praxisNeu, '--benutzer', benutzerNeu, '--ausgabe', join(ordner, 'aus')],
      { env: { ...process.env, LSB_PASSPHRASE: E.E2E_PASSPHRASE }, stdio: 'pipe' })
    const sql = readFileSync(join(ordner, 'aus', 'einspielen.sql'), 'utf8')

    for (const tab of ['schluesselbund', 'akte', 'sitzung', 'protokoll_version', 'register_eintrag', 'fin_buchung'])
      expect(sql).toMatch(new RegExp(`insert into public\\.${tab} `))
    expect(sql).toContain(praxisNeu)
    expect(sql).toContain(benutzerNeu)
    expect(sql).not.toMatch(/Mustermann|Testfrau/) // Inhalte bleiben verschlüsselt
    const dateien = readdirSync(join(ordner, 'aus', 'dateien'), { recursive: true, withFileTypes: true }).filter((d) => d.isFile())
    expect(dateien.length).toBe(uebersicht.dateien)
    await sb.auth.signOut({ scope: 'local' })
  }, 120_000)
})
