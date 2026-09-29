'use client'
// Protokolle lesen und schreiben: Metadaten im Klartext (pseudonym), Inhalte nur verschlüsselt mit K_B,
// Register (Chiffre ↔ Person) mit K_C. Der Server sieht nie Klartext der Inhalte.
import { aad, entschluessele, verschluessele } from '../crypto/kern'
import { supabaseBrowser } from '../supabase/client'
import { einheiten, minuten, naechsteChiffre, type Art, type Inhalt } from './modell'

const sb = () => supabaseBrowser()

export type Akte = { id: string; chiffre: string; status: 'offen' | 'abgeschlossen'; erstellt_am: string }
export type Sitzung = {
  id: string; akte_id: string; nr: number; art: Art; datum: string; beginn: string | null; ende: string | null
  arbeitseinheiten: number | null; vorbereitung_min: number; nachbereitung_min: number; prozess_abgeschlossen: boolean
  protokoll_status: 'entwurf' | 'abgeschlossen'; abgeschlossen_am: string | null; entwurf_enc: string | null
  herkunft: string | null; erstellt_am: string; geaendert_am: string
}
export type Version = { id: string; version: number; inhalt_enc: string; erstellt_am: string }
export type RegisterInhalt = { akte_id: string; chiffre: string; name?: string; kuerzel_alt?: string; notiz?: string }

const SITZUNG_FELDER = 'id, akte_id, nr, art, datum, beginn, ende, arbeitseinheiten, vorbereitung_min, nachbereitung_min, prozess_abgeschlossen, protokoll_status, abgeschlossen_am, entwurf_enc, herkunft, erstellt_am, geaendert_am'
const kurzZeit = (t: string | null) => (t ? t.slice(0, 5) : null)
const normalisiere = (s: Sitzung): Sitzung => ({ ...s, beginn: kurzZeit(s.beginn), ende: kurzZeit(s.ende), arbeitseinheiten: s.arbeitseinheiten === null ? null : Number(s.arbeitseinheiten) })

let praxisCache: { id: string; test: boolean } | null = null
export async function praxis() {
  if (praxisCache) return praxisCache
  const { data: b, error } = await sb().from('benutzer').select('praxis_id').single()
  if (error) throw error
  const { data: p } = await sb().from('praxis').select('einstellungen').eq('id', b.praxis_id).single()
  praxisCache = { id: b.praxis_id, test: !!(p?.einstellungen as { test?: boolean } | null)?.test }
  return praxisCache
}

// ---------- Akten ----------

export async function ladeAkten(): Promise<Akte[]> {
  const { data, error } = await sb().from('akte').select('id, chiffre, status, erstellt_am').order('erstellt_am', { ascending: false })
  if (error) throw error
  return data as Akte[]
}

/** Neue Akte mit automatischer Chiffre; legt zugleich einen verschlüsselten Registereintrag an (Zone C). */
export async function neueAkte(kC: CryptoKey, zusatz: Omit<RegisterInhalt, 'akte_id' | 'chiffre'> = {}, jahr = new Date().getFullYear()): Promise<Akte> {
  const p = await praxis()
  for (let versuch = 0; versuch < 5; versuch++) {
    const vorhandene = (await ladeAkten()).map((a) => a.chiffre)
    const chiffre = naechsteChiffre(vorhandene, jahr, p.test)
    const { data, error } = await sb().from('akte').insert({ praxis_id: p.id, chiffre }).select('id, chiffre, status, erstellt_am').single()
    if (error?.code === '23505') continue // Chiffre inzwischen vergeben – neu versuchen
    if (error) throw error
    const regId = crypto.randomUUID()
    const inhalt: RegisterInhalt = { akte_id: data.id, chiffre, ...zusatz }
    const { error: e2 } = await sb().from('register_eintrag').insert({ id: regId, praxis_id: p.id, inhalt_enc: await verschluessele(kC, JSON.stringify(inhalt), aad('register_eintrag', regId, 'inhalt')) })
    if (e2) throw e2
    return data as Akte
  }
  throw new Error('Chiffre konnte nicht vergeben werden')
}

export async function ladeRegister(kC: CryptoKey): Promise<(RegisterInhalt & { id: string })[]> {
  const { data, error } = await sb().from('register_eintrag').select('id, inhalt_enc')
  if (error) throw error
  const out = []
  for (const r of data ?? []) out.push({ id: r.id, ...(JSON.parse(await entschluessele(kC, r.inhalt_enc, aad('register_eintrag', r.id, 'inhalt'))) as RegisterInhalt) })
  return out
}

// ---------- Sitzungen und Protokolle ----------

export async function ladeSitzungen(): Promise<Sitzung[]> {
  const { data, error } = await sb().from('sitzung').select(SITZUNG_FELDER).order('datum', { ascending: false }).order('nr', { ascending: false })
  if (error) throw error
  return (data as Sitzung[]).map(normalisiere)
}

export async function ladeSitzung(id: string): Promise<Sitzung> {
  const { data, error } = await sb().from('sitzung').select(SITZUNG_FELDER).eq('id', id).single()
  if (error) throw error
  return normalisiere(data as Sitzung)
}

export async function naechsteNr(): Promise<number> {
  const { data } = await sb().from('sitzung').select('nr').order('nr', { ascending: false }).limit(1)
  return (data?.[0]?.nr ?? 0) + 1
}

export async function neueSitzung(akteId: string, art: Art, vorgaben: Partial<Sitzung> = {}): Promise<Sitzung> {
  const p = await praxis()
  const heute = new Date()
  const datum = vorgaben.datum ?? `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`
  const { data, error } = await sb().from('sitzung').insert({
    praxis_id: p.id, akte_id: akteId, art, nr: vorgaben.nr ?? (await naechsteNr()), datum,
    beginn: vorgaben.beginn ?? null, ende: vorgaben.ende ?? null,
    vorbereitung_min: vorgaben.vorbereitung_min ?? 15, nachbereitung_min: vorgaben.nachbereitung_min ?? 15,
    herkunft: vorgaben.herkunft ?? null,
  }).select(SITZUNG_FELDER).single()
  if (error) throw error
  return normalisiere(data as Sitzung)
}

type Kopf = Pick<Sitzung, 'datum' | 'beginn' | 'ende' | 'vorbereitung_min' | 'nachbereitung_min' | 'prozess_abgeschlossen'>

function kopfDaten(k: Kopf) {
  return { ...k, arbeitseinheiten: einheiten(minuten(k.beginn, k.ende)) || null, geaendert_am: new Date().toISOString() }
}

/** Entwurf speichern (überschreibt nur den Entwurf, nie eine Version) */
export async function speichereEntwurf(kB: CryptoKey, s: Sitzung, kopf: Kopf, inhalt: Inhalt) {
  if (s.protokoll_status !== 'entwurf') throw new Error('Abgeschlossene Protokolle nur über „Korrigieren“ ändern')
  const entwurf_enc = await verschluessele(kB, JSON.stringify(inhalt), aad('sitzung', s.id, 'entwurf'))
  const { error } = await sb().from('sitzung').update({ ...kopfDaten(kopf), entwurf_enc }).eq('id', s.id)
  if (error) throw error
}

export async function ladeVersionen(sitzungId: string): Promise<Version[]> {
  const { data, error } = await sb().from('protokoll_version').select('id, version, inhalt_enc, erstellt_am').eq('sitzung_id', sitzungId).order('version')
  if (error) throw error
  return data as Version[]
}

export async function entschluesseleVersion(kB: CryptoKey, v: Version): Promise<Inhalt> {
  return JSON.parse(await entschluessele(kB, v.inhalt_enc, aad('protokoll_version', v.id, 'inhalt')))
}

/** Aktueller Inhalt: Entwurf oder jüngste Version */
export async function ladeInhalt(kB: CryptoKey, s: Sitzung): Promise<{ inhalt: Inhalt; versionen: Version[] }> {
  const versionen = await ladeVersionen(s.id)
  if (s.protokoll_status === 'entwurf' && s.entwurf_enc) return { inhalt: JSON.parse(await entschluessele(kB, s.entwurf_enc, aad('sitzung', s.id, 'entwurf'))), versionen }
  const letzte = versionen.at(-1)
  return { inhalt: letzte ? await entschluesseleVersion(kB, letzte) : { felder: {}, supervision: false }, versionen }
}

/** Neue Version anhängen (Abschließen oder Korrektur). Vorhandene Versionen bleiben unverändert. */
export async function versionAnhaengen(kB: CryptoKey, s: Sitzung, kopf: Kopf, inhalt: Inhalt, zeiten: { erstellt_am?: string; abgeschlossen_am?: string } = {}) {
  const { erstellt_am } = zeiten
  const p = await praxis()
  const versionen = await ladeVersionen(s.id)
  const id = crypto.randomUUID()
  const inhalt_enc = await verschluessele(kB, JSON.stringify(inhalt), aad('protokoll_version', id, 'inhalt'))
  const { error } = await sb().from('protokoll_version').insert({ id, praxis_id: p.id, sitzung_id: s.id, version: (versionen.at(-1)?.version ?? 0) + 1, inhalt_enc, ...(erstellt_am ? { erstellt_am } : {}) })
  if (error) throw error
  const { error: e2 } = await sb().from('sitzung').update({
    ...kopfDaten(kopf), protokoll_status: 'abgeschlossen', entwurf_enc: null,
    abgeschlossen_am: zeiten.abgeschlossen_am ?? s.abgeschlossen_am ?? new Date().toISOString(),
  }).eq('id', s.id)
  if (e2) throw e2
}

export async function entwurfLoeschen(s: Sitzung) {
  const { error } = await sb().from('sitzung').delete().eq('id', s.id)
  if (error) throw error
}
