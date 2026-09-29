// Krypto-Kern des LSB Cockpit (Lösungsdesign Kap. 4.2/4.3) – ausschließlich Web Crypto, keine Fremdbibliothek.
//
//   Passphrase ──PBKDF2 (Salt „auth“ + E-Mail)──▶ Anmelde-Geheimnis (Supabase-Passwort)
//   Passphrase ──PBKDF2 (Zufalls-Salt)──────────▶ KEK ──AES-KW──▶ Master-Schlüssel ──AES-KW──▶ K_A, K_B, K_C
//   Wiederherstellungscode ──HKDF──────────────▶ KEK_R ──AES-KW──▶ zweite Kopie des Master-Schlüssels
//
// Gespeichert werden nur verpackte Schlüssel. Entpackte Schlüssel sind nicht exportierbare CryptoKey-Objekte.

import { ausBase64, ausCrockford, utf8, zuBase64, zuBase64Url, zuCrockford } from './kodierung'

const subtle = globalThis.crypto.subtle
export const PBKDF2_ITERATIONEN = 600_000
const FORMAT_V1 = 1
const NOTFALL_INFO = 'lsb-cockpit/notfall/v1'
const AUTH_SALT_PRAEFIX = 'lsb-cockpit/auth/v1\u0000'

export type Zone = 'zone_a' | 'zone_b' | 'zone_c'
export const ZONEN: Zone[] = ['zone_a', 'zone_b', 'zone_c']

export type KdfParameter =
  | { alg: 'PBKDF2-SHA256'; iter: number; salt: string }
  | { alg: 'HKDF-SHA256'; salt: string; info: string }

export const zufall = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n))

const normalisiere = (passphrase: string) => passphrase.normalize('NFC')

async function pbkdf2Bits(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterationen: number): Promise<ArrayBuffer> {
  const basis = await subtle.importKey('raw', utf8(normalisiere(passphrase)), 'PBKDF2', false, ['deriveBits'])
  return subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iterationen }, basis, 256)
}

// ---------- Anmelde-Geheimnis ----------

/** Deterministisch aus Passphrase und E-Mail; unabhängig von der KEK (anderes Salt). Wird als Supabase-Passwort verwendet. */
export async function anmeldeGeheimnis(passphrase: string, email: string, iterationen = PBKDF2_ITERATIONEN): Promise<string> {
  const salt = new Uint8Array(await subtle.digest('SHA-256', utf8(AUTH_SALT_PRAEFIX + email.trim().toLowerCase())))
  return zuBase64Url(await pbkdf2Bits(passphrase, salt, iterationen))
}

// ---------- Schlüssel-Schlüssel (KEK) ----------

export function neueKdfParameter(iterationen = PBKDF2_ITERATIONEN): KdfParameter {
  return { alg: 'PBKDF2-SHA256', iter: iterationen, salt: zuBase64(zufall(16)) }
}

export async function kekAusPassphrase(passphrase: string, kdf: KdfParameter): Promise<CryptoKey> {
  if (kdf.alg !== 'PBKDF2-SHA256') throw new Error('Unbekanntes Ableitungsverfahren')
  const bits = await pbkdf2Bits(passphrase, ausBase64(kdf.salt), kdf.iter)
  return subtle.importKey('raw', bits, 'AES-KW', false, ['wrapKey', 'unwrapKey'])
}

// ---------- Master- und Zonen-Schlüssel ----------

export const neuerMasterSchluessel = () =>
  subtle.generateKey({ name: 'AES-KW', length: 256 }, true, ['wrapKey', 'unwrapKey']) as Promise<CryptoKey>

export const neuerZonenSchluessel = () =>
  subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as Promise<CryptoKey>

export async function verpacke(schluessel: CryptoKey, mit: CryptoKey): Promise<string> {
  return zuBase64(await subtle.wrapKey('raw', schluessel, mit, 'AES-KW'))
}

/** Master-Schlüssel entpacken. exportierbar nur für Passphrasenwechsel/Wiederherstellung (Neu-Verpacken). */
export function entpackeMaster(verpackt: string, kek: CryptoKey, exportierbar = false): Promise<CryptoKey> {
  return subtle.unwrapKey('raw', ausBase64(verpackt), kek, 'AES-KW', { name: 'AES-KW', length: 256 }, exportierbar, ['wrapKey', 'unwrapKey'])
}

export function entpackeZone(verpackt: string, master: CryptoKey): Promise<CryptoKey> {
  return subtle.unwrapKey('raw', ausBase64(verpackt), master, 'AES-KW', { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

// ---------- Wiederherstellungscode ----------

/** 128 Bit Zufall als 26-stelliger Crockford-Code, zur Anzeige in Fünfergruppen */
export function neuerWiederherstellungscode(): string {
  return zuCrockford(zufall(16))
}

export function formatiereCode(code: string): string {
  return code.replace(/(.{5})(?=.)/g, '$1-')
}

export function neueNotfallParameter(): KdfParameter {
  return { alg: 'HKDF-SHA256', salt: zuBase64(zufall(16)), info: NOTFALL_INFO }
}

export async function kekAusCode(code: string, kdf: KdfParameter): Promise<CryptoKey> {
  if (kdf.alg !== 'HKDF-SHA256') throw new Error('Unbekanntes Ableitungsverfahren')
  const basis = await subtle.importKey('raw', ausCrockford(code, 16), 'HKDF', false, ['deriveKey'])
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: ausBase64(kdf.salt), info: utf8(kdf.info) }, basis, { name: 'AES-KW', length: 256 }, false, ['wrapKey', 'unwrapKey'])
}

// ---------- Datensätze verschlüsseln (AES-256-GCM, Format v1) ----------
// Aufbau: [1 Byte Version][12 Byte IV][Chiffretext + 16 Byte Tag], Base64.
// AAD bindet den Chiffretext an Tabelle, Datensatz und Feld: lsb:v1:<tabelle>:<id>:<feld>

export function aad(tabelle: string, id: string, feld: string): string {
  if (!/^[a-z_]+$/.test(tabelle) || !/^[a-z_]+$/.test(feld) || !id) throw new Error('Ungültige AAD-Angaben')
  return `lsb:v1:${tabelle}:${id}:${feld}`
}

export async function verschluessele(schluessel: CryptoKey, klartext: string, zusatz: string): Promise<string> {
  const iv = zufall(12)
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: utf8(zusatz) }, schluessel, utf8(klartext)))
  const out = new Uint8Array(1 + 12 + ct.length)
  out[0] = FORMAT_V1
  out.set(iv, 1)
  out.set(ct, 13)
  return zuBase64(out)
}

export async function entschluessele(schluessel: CryptoKey, chiffre: string, zusatz: string): Promise<string> {
  const daten = ausBase64(chiffre)
  if (daten.length < 1 + 12 + 16) throw new Error('Chiffretext zu kurz')
  if (daten[0] !== FORMAT_V1) throw new Error(`Unbekannte Formatversion ${daten[0]}`)
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: daten.slice(1, 13), additionalData: utf8(zusatz) }, schluessel, daten.slice(13))
  return new TextDecoder().decode(pt)
}

/** Dateien (z. B. Belege) – gleiches Format v1, aber als Bytes statt Base64 */
export async function verschluesseleBytes(schluessel: CryptoKey, daten: ArrayBuffer | Uint8Array<ArrayBuffer>, zusatz: string): Promise<Uint8Array<ArrayBuffer>> {
  const iv = zufall(12)
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: utf8(zusatz) }, schluessel, daten))
  const out = new Uint8Array(1 + 12 + ct.length)
  out[0] = FORMAT_V1
  out.set(iv, 1)
  out.set(ct, 13)
  return out
}

export async function entschluesseleBytes(schluessel: CryptoKey, daten: Uint8Array<ArrayBuffer>, zusatz: string): Promise<ArrayBuffer> {
  if (daten.length < 1 + 12 + 16) throw new Error('Chiffretext zu kurz')
  if (daten[0] !== FORMAT_V1) throw new Error(`Unbekannte Formatversion ${daten[0]}`)
  return subtle.decrypt({ name: 'AES-GCM', iv: daten.slice(1, 13), additionalData: utf8(zusatz) }, schluessel, daten.slice(13))
}

// ---------- Einrichtung als Ganzes ----------

export type SchluesselbundEintrag = { art: 'master' | 'notfall' | Zone; version: number; verpackt: string; kdf: KdfParameter | null }

/** Erzeugt Master- und Zonen-Schlüssel, verpackt sie für Passphrase und Wiederherstellungscode. */
export async function schluesselbundEinrichten(passphrase: string, iterationen = PBKDF2_ITERATIONEN) {
  const master = await neuerMasterSchluessel()
  const kdf = neueKdfParameter(iterationen)
  const kek = await kekAusPassphrase(passphrase, kdf)
  const code = neuerWiederherstellungscode()
  const notfallKdf = neueNotfallParameter()
  const kekR = await kekAusCode(code, notfallKdf)

  const eintraege: SchluesselbundEintrag[] = [
    { art: 'master', version: 1, verpackt: await verpacke(master, kek), kdf },
    { art: 'notfall', version: 1, verpackt: await verpacke(master, kekR), kdf: notfallKdf },
  ]
  for (const zone of ZONEN) eintraege.push({ art: zone, version: 1, verpackt: await verpacke(await neuerZonenSchluessel(), master), kdf: null })
  return { eintraege, wiederherstellungscode: code }
}

export type Tresorinhalt = Record<Zone, CryptoKey>

/** Aktuelle Einträge (je Art höchste Version) mit der Passphrase öffnen. Wirft bei falscher Passphrase. */
export async function schluesselbundOeffnen(eintraege: SchluesselbundEintrag[], passphrase: string): Promise<Tresorinhalt> {
  const aktuell = aktuellsteEintraege(eintraege)
  const m = aktuell.master
  if (!m?.kdf) throw new Error('Kein Master-Schlüssel eingerichtet')
  let master: CryptoKey
  try {
    master = await entpackeMaster(m.verpackt, await kekAusPassphrase(passphrase, m.kdf))
  } catch {
    throw new FalschePassphrase()
  }
  const out = {} as Tresorinhalt
  for (const zone of ZONEN) {
    const z = aktuell[zone]
    if (!z) throw new Error(`Zonen-Schlüssel ${zone} fehlt`)
    out[zone] = await entpackeZone(z.verpackt, master)
  }
  return out
}

export class FalschePassphrase extends Error {
  constructor() { super('Passphrase stimmt nicht') }
}

export function aktuellsteEintraege(eintraege: SchluesselbundEintrag[]) {
  const out: Partial<Record<SchluesselbundEintrag['art'], SchluesselbundEintrag>> = {}
  for (const e of eintraege) if (!out[e.art] || out[e.art]!.version < e.version) out[e.art] = e
  return out
}
