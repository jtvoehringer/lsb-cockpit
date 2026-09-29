'use client'
// Zone A: Stammdaten und Einwilligungen – Inhalt nur verschlüsselt mit K_A.
// Die Zuordnung Stammdaten ↔ Chiffre steht nur im Register (Zone C, Feld stammdaten_id).
// Auf der Akte liegt im Klartext nur das Datum der gültigen Datenschutz-Einwilligung (für Hinweise in Listen).
import { aad, entschluessele, entschluesseleBytes, verschluessele, verschluesseleBytes } from './crypto/kern'
import { praxis } from './protokolle/daten'
import { supabaseBrowser } from './supabase/client'

const sb = () => supabaseBrowser()

export type EinwilligungsArt = 'vereinbarung' | 'datenschutz' | 'entbindung' | 'email' | 'aufbewahrung'
export const EINWILLIGUNGEN: Record<EinwilligungsArt, { titel: string; hinweis: string }> = {
  vereinbarung: { titel: 'Beratungsvereinbarung', hinweis: 'Rahmen, Honorar, Absage, Verschwiegenheit' },
  datenschutz: { titel: 'Einwilligung Gesundheitsdaten (Art. 9 DSGVO)', hinweis: 'Voraussetzung für die Dokumentation; jederzeit widerrufbar' },
  entbindung: { titel: 'Entbindung von der Verschwiegenheit', hinweis: 'nur falls nötig, mit Empfänger und Zweck in der Notiz' },
  email: { titel: 'Kommunikation per E-Mail (Opt-in)', hinweis: 'unverschlüsselte E-Mail ausdrücklich erlaubt' },
  aufbewahrung: { titel: 'Zustimmung zur längeren Aufbewahrung', hinweis: 'verlängerte Frist laut Einstellungen' },
}

export type Einwilligung = { id: string; art: EinwilligungsArt; erteilt_am: string; widerrufen_am?: string; notiz?: string }

export type StammdatenInhalt = {
  geburtsjahr?: string
  telefon?: string
  email?: string
  minderjaehrig?: boolean
  erziehungsberechtigte?: string
  notfallkontakt?: string
  notiz?: string
  einwilligungen: Einwilligung[]
}

export const leereStammdaten = (): StammdatenInhalt => ({ einwilligungen: [] })

/** Datum der gültigen (erteilten, nicht widerrufenen) Einwilligung dieser Art – die jüngste zählt. */
export function gueltigeEinwilligung(s: StammdatenInhalt, art: EinwilligungsArt, stichtag = heuteIso()): string | null {
  const passend = s.einwilligungen
    .filter((e) => e.art === art && e.erteilt_am && e.erteilt_am <= stichtag)
    .sort((a, b) => b.erteilt_am.localeCompare(a.erteilt_am))
  const j = passend[0]
  if (!j) return null
  if (j.widerrufen_am && j.widerrufen_am <= stichtag) return null
  return j.erteilt_am
}

export function heuteIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Minimale Plausibilitätsprüfung vor dem Speichern (keine Klientendaten in Fehlertexten). */
export function pruefeStammdaten(s: StammdatenInhalt): string[] {
  const f: string[] = []
  if (s.geburtsjahr && !/^(19|20)\d{2}$/.test(s.geburtsjahr.trim())) f.push('Geburtsjahr bitte vierstellig (z. B. 1985).')
  if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) f.push('E-Mail-Adresse ist ungültig.')
  for (const e of s.einwilligungen) {
    if (!e.erteilt_am) f.push(`${EINWILLIGUNGEN[e.art].titel}: Datum fehlt.`)
    if (e.widerrufen_am && e.erteilt_am && e.widerrufen_am < e.erteilt_am) f.push(`${EINWILLIGUNGEN[e.art].titel}: Widerruf liegt vor der Erteilung.`)
  }
  if (s.minderjaehrig && !s.erziehungsberechtigte?.trim()) f.push('Bei Minderjährigen bitte die Erziehungsberechtigten eintragen.')
  return f
}

// ---------- Datenbank ----------

export async function ladeStammdaten(kA: CryptoKey, id: string): Promise<StammdatenInhalt> {
  const { data, error } = await sb().from('stammdaten').select('id, inhalt_enc').eq('id', id).single()
  if (error) throw error
  return { ...leereStammdaten(), ...JSON.parse(await entschluessele(kA, data.inhalt_enc, aad('stammdaten', id, 'inhalt'))) }
}

/** Speichert (legt bei id = null neu an) und gibt die ID zurück. */
export async function speichereStammdaten(kA: CryptoKey, id: string | null, inhalt: StammdatenInhalt): Promise<string> {
  const neuId = id ?? crypto.randomUUID()
  const inhalt_enc = await verschluessele(kA, JSON.stringify(inhalt), aad('stammdaten', neuId, 'inhalt'))
  if (id) {
    const { error } = await sb().from('stammdaten').update({ inhalt_enc, geaendert_am: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    return id
  }
  const p = await praxis()
  const { error } = await sb().from('stammdaten').insert({ id: neuId, praxis_id: p.id, inhalt_enc })
  if (error) throw error
  return neuId
}

/** Pseudonymes Kennzeichen auf der Akte: Datum der gültigen Datenschutz-Einwilligung oder null. */
export async function setzeEinwilligungAkte(akteId: string, datum: string | null) {
  const { error } = await sb().from('akte').update({ einwilligung_am: datum }).eq('id', akteId)
  if (error) throw error
}

// ---------- Dokumente (Scans unterschriebener Formulare) ----------

export type DokumentInfo = { id: string; pfad: string; name: string; typ: string; groesse: number; art: EinwilligungsArt | 'sonstiges'; erstellt_am: string }
const MAX_BYTES = 10 * 1024 * 1024

export async function ladeDokumente(kA: CryptoKey, stammdatenId: string): Promise<DokumentInfo[]> {
  const { data, error } = await sb().from('stammdaten_dokument').select('id, pfad, meta_enc, erstellt_am').eq('stammdaten_id', stammdatenId).order('erstellt_am')
  if (error) throw error
  const out: DokumentInfo[] = []
  for (const d of data ?? []) out.push({ id: d.id, pfad: d.pfad, erstellt_am: d.erstellt_am, ...JSON.parse(await entschluessele(kA, d.meta_enc, aad('stammdaten_dokument', d.id, 'meta'))) })
  return out
}

export async function dokumentHochladen(kA: CryptoKey, stammdatenId: string, datei: File, art: DokumentInfo['art']) {
  if (datei.size > MAX_BYTES) throw new Error('Datei ist größer als 10 MB.')
  const p = await praxis()
  const id = crypto.randomUUID()
  const pfad = `${p.id}/${crypto.randomUUID()}`
  const inhalt = await verschluesseleBytes(kA, await datei.arrayBuffer(), aad('stammdaten_dokument', id, 'datei'))
  const { error } = await sb().storage.from('dokumente').upload(pfad, new Blob([inhalt], { type: 'application/octet-stream' }), { contentType: 'application/octet-stream', upsert: false })
  if (error) throw error
  const meta_enc = await verschluessele(kA, JSON.stringify({ name: datei.name, typ: datei.type || 'application/octet-stream', groesse: datei.size, art }), aad('stammdaten_dokument', id, 'meta'))
  const { error: e2 } = await sb().from('stammdaten_dokument').insert({ id, praxis_id: p.id, stammdaten_id: stammdatenId, pfad, meta_enc })
  if (e2) { await sb().storage.from('dokumente').remove([pfad]); throw e2 }
}

export async function dokumentOeffnen(kA: CryptoKey, d: DokumentInfo): Promise<Blob> {
  const { data, error } = await sb().storage.from('dokumente').download(d.pfad)
  if (error) throw error
  const klar = await entschluesseleBytes(kA, new Uint8Array(await data.arrayBuffer()), aad('stammdaten_dokument', d.id, 'datei'))
  return new Blob([klar], { type: d.typ })
}

export async function dokumentLoeschen(d: DokumentInfo) {
  const { error } = await sb().storage.from('dokumente').remove([d.pfad])
  if (error) throw error
  const { error: e2 } = await sb().from('stammdaten_dokument').delete().eq('id', d.id)
  if (e2) throw e2
}
