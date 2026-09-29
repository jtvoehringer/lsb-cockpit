'use client'
// Finanzen lesen und schreiben. Beträge/Datum/Kategorie im Klartext (Summen in der DB),
// Beschreibung und Belege nur verschlüsselt mit K_A (dort können Namen von Klient:innen stehen).
import { aad, entschluessele, entschluesseleBytes, verschluessele, verschluesseleBytes } from '../crypto/kern'
import { praxis } from '../protokolle/daten'
import { supabaseBrowser } from '../supabase/client'
import { STANDARD_KATEGORIEN, type FinArt, type Summenzeile, type Zahlungsart } from './modell'

const sb = () => supabaseBrowser()

export type Kategorie = { id: string; name: string; art: FinArt; e1a_kz: string | null; sortierung: number; aktiv: boolean }
export type Buchung = {
  id: string; art: FinArt; datum: string; betrag: number; kategorie_id: string; zahlungsart: Zahlungsart
  beschreibung: string; belege: BelegInfo[]; sitzung_id: string | null
}
export type BelegInfo = { id: string; pfad: string; name: string; typ: string; groesse: number }

export async function ladeKategorien(): Promise<Kategorie[]> {
  const { data, error } = await sb().from('fin_kategorie').select('id, name, art, e1a_kz, sortierung, aktiv').order('art').order('sortierung').order('name')
  if (error) throw error
  if (data.length) return data as Kategorie[]
  // Erste Nutzung: Startkategorien anlegen
  const p = await praxis()
  const { error: e2 } = await sb().from('fin_kategorie').insert(STANDARD_KATEGORIEN.map((k, i) => ({ ...k, praxis_id: p.id, sortierung: (i + 1) * 10 })))
  if (e2 && e2.code !== '23505') throw e2 // 23505: gleichzeitig schon angelegt (z. B. zweiter Tab) – dann einfach neu laden
  return ladeKategorien()
}

export async function kategorieAnlegen(name: string, art: FinArt) {
  const p = await praxis()
  const { error } = await sb().from('fin_kategorie').insert({ praxis_id: p.id, name: name.trim(), art, sortierung: 900 })
  if (error) throw error.code === '23505' ? new Error('Diese Kategorie gibt es schon.') : error
}

export async function kategorieAendern(id: string, werte: Partial<Pick<Kategorie, 'name' | 'e1a_kz' | 'aktiv' | 'sortierung'>>) {
  const { error } = await sb().from('fin_kategorie').update(werte).eq('id', id)
  if (error) throw error
}

export async function ladeBuchungen(kA: CryptoKey, von: string, bis: string): Promise<Buchung[]> {
  const { data, error } = await sb().from('fin_buchung')
    .select('id, art, datum, betrag, kategorie_id, zahlungsart, beschreibung_enc, sitzung_id, fin_beleg(id, pfad, meta_enc)')
    .gte('datum', von).lte('datum', bis).order('datum', { ascending: false }).order('erstellt_am', { ascending: false })
  if (error) throw error
  const out: Buchung[] = []
  for (const b of data ?? []) {
    const belege: BelegInfo[] = []
    for (const x of (b.fin_beleg as { id: string; pfad: string; meta_enc: string }[]) ?? []) {
      belege.push({ id: x.id, pfad: x.pfad, ...JSON.parse(await entschluessele(kA, x.meta_enc, aad('fin_beleg', x.id, 'meta'))) })
    }
    out.push({
      id: b.id, art: b.art, datum: b.datum, betrag: Number(b.betrag), kategorie_id: b.kategorie_id, zahlungsart: b.zahlungsart, sitzung_id: b.sitzung_id,
      beschreibung: b.beschreibung_enc ? await entschluessele(kA, b.beschreibung_enc, aad('fin_buchung', b.id, 'beschreibung')) : '',
      belege,
    })
  }
  return out
}

export type BuchungEingabe = { art: FinArt; datum: string; betrag: number; kategorie_id: string; zahlungsart: Zahlungsart; beschreibung: string }

export async function buchungSpeichern(kA: CryptoKey, eingabe: BuchungEingabe, id?: string): Promise<string> {
  const p = await praxis()
  const bid = id ?? crypto.randomUUID()
  const beschreibung_enc = eingabe.beschreibung.trim() ? await verschluessele(kA, eingabe.beschreibung.trim(), aad('fin_buchung', bid, 'beschreibung')) : null
  const werte = { datum: eingabe.datum, betrag: eingabe.betrag, kategorie_id: eingabe.kategorie_id, zahlungsart: eingabe.zahlungsart, beschreibung_enc }
  const { error } = id
    ? await sb().from('fin_buchung').update({ ...werte, geaendert_am: new Date().toISOString() }).eq('id', id)
    : await sb().from('fin_buchung').insert({ id: bid, praxis_id: p.id, art: eingabe.art, ...werte })
  if (error) throw error
  return bid
}

export async function buchungLoeschen(b: Buchung) {
  for (const x of b.belege) await belegLoeschen(x)
  const { error } = await sb().from('fin_buchung').delete().eq('id', b.id)
  if (error) throw error
}

export const MAX_BELEG_BYTES = 10 * 1024 * 1024

/** Beleg im Browser verschlüsseln und hochladen. Der Speicher sieht nur Chiffretext und eine zufällige ID. */
export async function belegHochladen(kA: CryptoKey, buchungId: string, datei: File) {
  if (datei.size > MAX_BELEG_BYTES) throw new Error('Datei ist größer als 10 MB.')
  const p = await praxis()
  const id = crypto.randomUUID()
  const pfad = `${p.id}/${crypto.randomUUID()}`
  const inhalt = await verschluesseleBytes(kA, await datei.arrayBuffer(), aad('fin_beleg', id, 'datei'))
  const { error } = await sb().storage.from('belege').upload(pfad, new Blob([inhalt], { type: 'application/octet-stream' }), { contentType: 'application/octet-stream', upsert: false })
  if (error) throw error
  const meta_enc = await verschluessele(kA, JSON.stringify({ name: datei.name, typ: datei.type || 'application/octet-stream', groesse: datei.size }), aad('fin_beleg', id, 'meta'))
  const { error: e2 } = await sb().from('fin_beleg').insert({ id, praxis_id: p.id, buchung_id: buchungId, pfad, meta_enc })
  if (e2) { await sb().storage.from('belege').remove([pfad]); throw e2 }
}

export async function belegOeffnen(kA: CryptoKey, b: BelegInfo): Promise<Blob> {
  const { data, error } = await sb().storage.from('belege').download(b.pfad)
  if (error) throw error
  const klar = await entschluesseleBytes(kA, new Uint8Array(await data.arrayBuffer()), aad('fin_beleg', b.id, 'datei'))
  return new Blob([klar], { type: b.typ })
}

export async function belegLoeschen(b: BelegInfo) {
  const { error } = await sb().storage.from('belege').remove([b.pfad])
  if (error) throw error
  const { error: e2 } = await sb().from('fin_beleg').delete().eq('id', b.id)
  if (e2) throw e2
}

export async function jahressummen(jahr: number): Promise<Summenzeile[]> {
  const { data, error } = await sb().rpc('fin_jahressummen', { jahr })
  if (error) throw error
  return (data ?? []).map((z: Summenzeile) => ({ ...z, summe: Number(z.summe), anzahl: Number(z.anzahl) }))
}
