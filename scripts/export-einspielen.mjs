// Gesamt-Export in eine neue (leere) Installation einspielen – nur ICP, lokal, für Anbieterwechsel oder Katastrophenfall (B-11).
//
// Ablauf:
//   1. Im Ziel-Projekt Migrationen einspielen und mit scripts/konto-anlegen.mjs Praxis und Konto der Beraterin anlegen
//      (Einrichtung NICHT durchführen – der Schlüsselbund kommt aus dem Export).
//   2. node scripts/export-einspielen.mjs <export.json> --praxis <neue praxis_id> --benutzer <neue user_id> [--ausgabe <ordner>]
//      Fragt nach dem Wiederherstellungscode (Notfallblatt) oder – bei Konten mit Passphrase – nach der Passphrase.
//   3. <ordner>/einspielen.sql im SQL-Editor des Ziel-Projekts ausführen (Rolle postgres).
//   4. Dateien aus <ordner>/dateien/<bucket>/… in die gleichnamigen Buckets hochladen (Pfade sind bereits umgeschrieben),
//      oder mit --hochladen und SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY direkt hochladen lassen.
//   5. Die Beraterin meldet sich an (E-Mail-Code, neuer Authenticator) und entsperrt mit Notfallblatt, Passphrase oder Passkey.
//
// Das Skript entfernt nur die äußere Export-Verschlüsselung. Alle Inhalte (Namen, Protokolle, Stammdaten, Dateien) bleiben
// Ende-zu-Ende-verschlüsselt; die Datensatz-IDs bleiben gleich, daher passen die AAD-Bindungen weiter.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'

const subtle = globalThis.crypto.subtle
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
const datei = process.argv[2]
const praxisNeu = arg('--praxis'), benutzerNeu = arg('--benutzer'), ausgabe = arg('--ausgabe') ?? 'wiederherstellung'
const uuid = /^[0-9a-f-]{36}$/i
if (!datei || !uuid.test(praxisNeu ?? '') || !uuid.test(benutzerNeu ?? '')) {
  console.error('Aufruf: node scripts/export-einspielen.mjs <export.json> --praxis <uuid> --benutzer <uuid> [--ausgabe <ordner>] [--hochladen]')
  process.exit(1)
}

// ---------- Kodierung und Krypto (identisch zu src/lib/crypto) ----------
const b64 = (s) => Uint8Array.from(Buffer.from(s, 'base64'))
const utf8 = (s) => new TextEncoder().encode(s)
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
function ausCrockford(text, laenge) {
  const norm = text.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  const out = new Uint8Array(laenge); let bits = 0, wert = 0, i = 0
  for (const c of norm) {
    const v = CROCKFORD.indexOf(c); if (v < 0) throw new Error('Ungültiges Zeichen im Code')
    wert = ((wert << 5) | v) & 0xffff; bits += 5
    if (bits >= 8) { if (i >= laenge) throw new Error('Code zu lang'); out[i++] = (wert >>> (bits - 8)) & 0xff; bits -= 8 }
  }
  if (i !== laenge) throw new Error('Code unvollständig')
  return out
}
async function kekAusCode(code, kdf) {
  const basis = await subtle.importKey('raw', ausCrockford(code, 16), 'HKDF', false, ['deriveKey'])
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: b64(kdf.salt), info: utf8(kdf.info) }, basis, { name: 'AES-KW', length: 256 }, false, ['unwrapKey'])
}
async function kekAusPassphrase(p, kdf) {
  const basis = await subtle.importKey('raw', utf8(p.normalize('NFC')), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(kdf.salt), iterations: kdf.iter }, basis, 256)
  return subtle.importKey('raw', bits, 'AES-KW', false, ['unwrapKey'])
}
const entpacke = (verpackt, kek, alg, nutzung) => subtle.unwrapKey('raw', b64(verpackt), kek, 'AES-KW', alg, false, nutzung)
async function entschluessele(key, daten, zusatz) {
  if (daten[0] !== 1) throw new Error('Unbekanntes Format')
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: daten.slice(1, 13), additionalData: utf8(zusatz) }, key, daten.slice(13)))
}
const aktuellste = (bund, art) => bund.filter((e) => e.art === art).sort((a, b) => b.version - a.version)[0]

// ---------- Export öffnen ----------
const exp = JSON.parse(readFileSync(datei, 'utf8'))
if (exp?.kopf?.format !== 'lsb-cockpit-export' || exp.kopf.version !== 1) throw new Error('Keine Exportdatei des LSB Cockpit')
const bund = exp.kopf.schluesselbund
// Nicht-interaktiv (nur für den automatischen Test): LSB_NOTFALLCODE bzw. LSB_PASSPHRASE
const rl = createInterface({ input: process.stdin, output: process.stdout })
const frage = async (text, env) => process.env[env] ?? (await rl.question(text))
const eingabe = (process.env.LSB_PASSPHRASE ? '' : await frage('Wiederherstellungscode (Notfallblatt) – oder leer lassen für Passphrase: ', 'LSB_NOTFALLCODE')).trim()
let master
if (eingabe) {
  const n = aktuellste(bund, 'notfall')
  master = await entpacke(n.verpackt, await kekAusCode(eingabe, n.kdf), { name: 'AES-KW', length: 256 }, ['unwrapKey']).catch(() => { throw new Error('Wiederherstellungscode stimmt nicht.') })
} else {
  const m = aktuellste(bund, 'master'); if (!m) throw new Error('Dieses Konto hat keine Passphrase – bitte den Wiederherstellungscode verwenden.')
  const p = await frage('Passphrase: ', 'LSB_PASSPHRASE')
  master = await entpacke(m.verpackt, await kekAusPassphrase(p, m.kdf), { name: 'AES-KW', length: 256 }, ['unwrapKey']).catch(() => { throw new Error('Passphrase stimmt nicht.') })
}
rl.close()
const kA = await entpacke(aktuellste(bund, 'zone_a').verpackt, master, { name: 'AES-GCM', length: 256 }, ['decrypt'])
const roh = new TextDecoder().decode(await entschluessele(kA, b64(exp.kopf.exportschluessel_enc), `lsb:v1:export:${exp.kopf.export_id}:schluessel`))
const kExport = await subtle.importKey('raw', b64(roh), { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
const inhalt = JSON.parse(new TextDecoder().decode(await entschluessele(kExport, b64(exp.inhalt), `lsb:export:v1:inhalt:${exp.kopf.export_id}`)))
console.log(`Export vom ${exp.kopf.erstellt_am} geöffnet.`)

// ---------- IDs der neuen Installation einsetzen ----------
const t = inhalt.tabellen
const praxisAlt = t.praxis?.[0]?.id
const benutzerAlt = new Set([...bund.map((e) => e.user_id), ...exp.kopf.passkey_schluessel.map((e) => e.user_id)])
const pfadNeu = (p) => (praxisAlt && p.startsWith(praxisAlt + '/') ? praxisNeu + p.slice(praxisAlt.length) : p)
const umschreiben = (z) => {
  const x = { ...z }
  if ('praxis_id' in x) x.praxis_id = praxisNeu
  for (const k of ['user_id', 'geloescht_von']) if (k in x) x[k] = benutzerNeu
  if (typeof x.pfad === 'string') x.pfad = pfadNeu(x.pfad)
  return x
}

// Reihenfolge nach Fremdschlüsseln; Support-Freigaben werden nicht übernommen
const REIHENFOLGE = ['akte', 'sitzung', 'protokoll_version', 'register_eintrag', 'stammdaten', 'stammdaten_dokument',
  'fin_kategorie', 'fin_buchung', 'fin_beleg', 'fin_honorarnote', 'loeschprotokoll', 'audit_log']
const IDENTITY = new Set(['audit_log'])
const sql = ['-- Wiederherstellung aus Export ' + exp.kopf.export_id + ' vom ' + exp.kopf.erstellt_am, 'begin;']
if (t.praxis?.[0]) sql.push(`update public.praxis set einstellungen = $j$${JSON.stringify(t.praxis[0].einstellungen ?? {})}$j$::jsonb where id = '${praxisNeu}';`)
const block = (tabelle, zeilen) => zeilen.length
  ? `insert into public.${tabelle} ${IDENTITY.has(tabelle) ? 'overriding system value ' : ''}select * from json_populate_recordset(null::public.${tabelle}, $j$${JSON.stringify(zeilen)}$j$);`
  : `-- ${tabelle}: keine Zeilen`
sql.push(block('schluesselbund', bund.map(umschreiben)))
sql.push(block('passkey_schluessel', exp.kopf.passkey_schluessel.map(umschreiben)))
for (const tab of REIHENFOLGE) {
  let zeilen = (t[tab] ?? []).map(umschreiben)
  if (tab === 'audit_log') zeilen = (t[tab] ?? []).filter((z) => benutzerAlt.has(z.user_id)).map(umschreiben) // Einträge des Supports entfallen
  sql.push(block(tab, zeilen))
}
sql.push("update public.benutzer set eingerichtet_am = now() where user_id = '" + benutzerNeu + "';")
sql.push("select setval(pg_get_serial_sequence('public.audit_log', 'id'), coalesce((select max(id) from public.audit_log), 1));")
sql.push('commit;')
mkdirSync(ausgabe, { recursive: true })
writeFileSync(join(ausgabe, 'einspielen.sql'), sql.join('\n\n') + '\n')

// ---------- Dateien (bleiben verschlüsselt) ----------
const dateien = inhalt.dateien.map((d) => ({ bucket: d.bucket, pfad: pfadNeu(d.pfad), daten: Buffer.from(d.daten, 'base64') }))
for (const d of dateien) { const ziel = join(ausgabe, 'dateien', d.bucket, d.pfad); mkdirSync(dirname(ziel), { recursive: true }); writeFileSync(ziel, d.daten) }
console.log(`Geschrieben: ${join(ausgabe, 'einspielen.sql')} (${REIHENFOLGE.map((x) => `${x} ${(t[x] ?? []).length}`).join(', ')}), ${dateien.length} Dateien in ${join(ausgabe, 'dateien')}`)

if (process.argv.includes('--hochladen')) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Für --hochladen SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzen.')
  for (const d of dateien) {
    const r = await fetch(`${url}/storage/v1/object/${d.bucket}/${d.pfad}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/octet-stream' }, body: d.daten })
    if (!r.ok) throw new Error(`Hochladen ${d.bucket}/${d.pfad}: ${r.status} ${await r.text()}`)
  }
  console.log(`${dateien.length} Dateien hochgeladen.`)
}
