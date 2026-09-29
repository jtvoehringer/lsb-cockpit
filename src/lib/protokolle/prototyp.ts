// Lesen der Daten aus dem Diktat-Prototyp (lsb.icp-consultants.at vor dem Cockpit):
// Browser-Speicher „lsb-protokolle“ oder verschlüsselte Sicherungsdatei. Format siehe prototyp/store.js.
import { ausBase64, utf8 } from '../crypto/kodierung'
import type { Art, Feld } from './modell'

export type PrototypProtokoll = {
  id: string; nr: number; art: Art; kuerzel: string; datum: string; beginn: string; ende: string
  vorbereitungMin?: number; nachbereitungMin?: number; felder: Partial<Record<Feld, string>>
  prozessAbgeschlossen?: boolean; supervision?: boolean; status: 'entwurf' | 'abgeschlossen'
  erstelltAm: string; geaendertAm: string; abgeschlossenAm: string | null
  versionen?: { gespeichertAm: string; fassung: Omit<PrototypProtokoll, 'versionen'> }[]
}

export type PrototypQuelle = {
  kdf: { salt: string; iterations: number }
  verifier: { iv: string; ct: string }
  records: { id: string; iv: string; ct: string }[]
}

const VERIFIER = 'lsb-protokolle-v1'

async function schluessel(passphrase: string, salt: string, iterationen: number) {
  const basis = await crypto.subtle.importKey('raw', utf8(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: ausBase64(salt), iterations: iterationen }, basis, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
}

async function entschluessele(k: CryptoKey, box: { iv: string; ct: string }, zusatz: string) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ausBase64(box.iv), additionalData: utf8(zusatz) }, k, ausBase64(box.ct))
  return new TextDecoder().decode(pt)
}

export class FalschePrototypPassphrase extends Error {
  constructor() { super('Die Passphrase des Diktat-Prototyps stimmt nicht.') }
}

export async function oeffnePrototyp(q: PrototypQuelle, passphrase: string): Promise<PrototypProtokoll[]> {
  const k = await schluessel(passphrase, q.kdf.salt, q.kdf.iterations)
  try {
    if ((await entschluessele(k, q.verifier, 'verifier')) !== VERIFIER) throw 0
  } catch { throw new FalschePrototypPassphrase() }
  const out: PrototypProtokoll[] = []
  for (const r of q.records) out.push(JSON.parse(await entschluessele(k, r, 'protokoll:' + r.id)))
  return out.sort((a, b) => (a.datum || '').localeCompare(b.datum || '') || a.nr - b.nr)
}

/** Sicherungsdatei des Prototyps (JSON) in eine Quelle umwandeln */
export function ausSicherung(json: unknown): PrototypQuelle {
  const b = json as { format?: string; kdf?: { salt: string; iterations: number }; verifier?: { iv: string; ct: string }; records?: PrototypQuelle['records'] }
  if (b?.format !== 'lsb-protokolle-sicherung' || !b.kdf || !b.verifier || !Array.isArray(b.records)) throw new Error('Das ist keine Sicherungsdatei des Diktat-Prototyps.')
  return { kdf: b.kdf, verifier: b.verifier, records: b.records }
}

/** Browser-Speicher des Prototyps – nur vorhanden, wenn das Cockpit unter derselben Adresse läuft */
export async function ausBrowserSpeicher(): Promise<PrototypQuelle | null> {
  if (!(await indexedDB.databases?.())?.some((d) => d.name === 'lsb-protokolle')) return null
  const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('lsb-protokolle'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  try {
    if (!db.objectStoreNames.contains('meta') || !db.objectStoreNames.contains('records')) return null
    const lies = <T,>(store: string, f: (s: IDBObjectStore) => IDBRequest<T>) => new Promise<T>((res, rej) => { const r = f(db.transaction(store).objectStore(store)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    const meta = await lies<{ salt: string; iterations: number; verifier: { iv: string; ct: string } } | undefined>('meta', (s) => s.get('kdf'))
    if (!meta) return null
    const records = await lies<PrototypQuelle['records']>('records', (s) => s.getAll())
    return { kdf: { salt: meta.salt, iterations: meta.iterations }, verifier: meta.verifier, records }
  } finally { db.close() }
}

/** Plan: je altem Kürzel eine neue Akte; Protokolle, die schon übernommen wurden, werden übersprungen */
export function plane(protokolle: PrototypProtokoll[], bereitsUebernommen: Set<string>) {
  const neu = protokolle.filter((p) => !bereitsUebernommen.has(p.id))
  const kuerzel = [...new Set(neu.map((p) => (p.kuerzel || '').trim() || '(ohne Kürzel)'))].sort()
  return { neu, uebersprungen: protokolle.length - neu.length, kuerzel }
}
