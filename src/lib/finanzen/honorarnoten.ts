'use client'
// Honorarnoten aus Sitzungen. Klartext: Nummer, Datum, Betrag, Status, abgerechnete Sitzungen (pseudonym).
// Verschlüsselt (K_A): Empfänger und Positionen. Einnahme wird nach dem Zufluss-Prinzip erst bei Zahlung gebucht.
import { aad, entschluessele, verschluessele } from '../crypto/kern'
import { praxis } from '../protokolle/daten'
import { supabaseBrowser } from '../supabase/client'
import { buchungSpeichern, ladeKategorien } from './daten'
import type { Zahlungsart } from './modell'

const sb = () => supabaseBrowser()

export type Position = { datum: string; text: string; einheiten: number; satz: number; betrag: number }
export type HonorarnoteInhalt = { empfaenger: { name: string; adresse: string }; positionen: Position[]; hinweis: string }
export type Honorarnote = {
  id: string; jahr: number; laufnr: number; nummer: string; datum: string; akte_id: string; sitzung_ids: string[]
  betrag: number; status: 'offen' | 'bezahlt' | 'storniert'; bezahlt_am: string | null; buchung_id: string | null; inhalt: HonorarnoteInhalt
}

export const nummer = (jahr: number, laufnr: number) => `${jahr}-${String(laufnr).padStart(4, '0')}`
export const summe = (p: Position[]) => Math.round(p.reduce((s, x) => s + Math.round(x.betrag * 100), 0)) / 100
export const positionsBetrag = (einheiten: number, satz: number) => Math.round(einheiten * satz * 100) / 100

export async function ladeHonorarnoten(kA: CryptoKey): Promise<Honorarnote[]> {
  const { data, error } = await sb().from('fin_honorarnote').select('id, jahr, laufnr, datum, akte_id, sitzung_ids, betrag, status, bezahlt_am, buchung_id, inhalt_enc').order('jahr', { ascending: false }).order('laufnr', { ascending: false })
  if (error) throw error
  const out: Honorarnote[] = []
  for (const h of data ?? []) {
    out.push({ ...h, betrag: Number(h.betrag), nummer: nummer(h.jahr, h.laufnr), inhalt: JSON.parse(await entschluessele(kA, h.inhalt_enc, aad('fin_honorarnote', h.id, 'inhalt'))) })
  }
  return out
}

/** Nächste Nummer im Jahr; bei gleichzeitiger Vergabe greift der eindeutige Index und es wird neu versucht */
async function naechsteLaufnr(jahr: number) {
  const { data } = await sb().from('fin_honorarnote').select('laufnr').eq('jahr', jahr).order('laufnr', { ascending: false }).limit(1)
  return (data?.[0]?.laufnr ?? 0) + 1
}

async function honorarKategorie() {
  const k = await ladeKategorien()
  return (k.find((x) => x.art === 'einnahme' && x.aktiv && x.name.startsWith('Honorare Einzelberatung')) ?? k.find((x) => x.art === 'einnahme' && x.aktiv))!.id
}

export async function ausstellen(kA: CryptoKey, e: { akte_id: string; chiffre: string; datum: string; sitzung_ids: string[]; inhalt: HonorarnoteInhalt; sofortBezahlt?: Zahlungsart }): Promise<string> {
  const p = await praxis()
  const betrag = summe(e.inhalt.positionen)
  if (!(betrag > 0)) throw new Error('Der Betrag muss größer als 0 sein – Honorarsatz in den Einstellungen prüfen.')
  const jahr = Number(e.datum.slice(0, 4))
  for (let versuch = 0; versuch < 5; versuch++) {
    const id = crypto.randomUUID()
    const laufnr = await naechsteLaufnr(jahr)
    const inhalt_enc = await verschluessele(kA, JSON.stringify(e.inhalt), aad('fin_honorarnote', id, 'inhalt'))
    const { error } = await sb().from('fin_honorarnote').insert({ id, praxis_id: p.id, jahr, laufnr, datum: e.datum, akte_id: e.akte_id, sitzung_ids: e.sitzung_ids, betrag, inhalt_enc })
    if (error?.code === '23505') continue
    if (error) throw error
    if (e.sofortBezahlt) await alsBezahlt(kA, { id, jahr, laufnr, betrag, akte_id: e.akte_id }, e.chiffre, e.datum, e.sofortBezahlt)
    return id
  }
  throw new Error('Honorarnoten-Nummer konnte nicht vergeben werden')
}

/** Zahlung erfassen → Einnahme buchen (Beschreibung nur mit Nummer und Chiffre, verschlüsselt) */
export async function alsBezahlt(kA: CryptoKey, h: Pick<Honorarnote, 'id' | 'jahr' | 'laufnr' | 'betrag' | 'akte_id'>, chiffre: string, datum: string, zahlungsart: Zahlungsart) {
  const buchungId = await buchungSpeichern(kA, { art: 'einnahme', datum, betrag: h.betrag, kategorie_id: await honorarKategorie(), zahlungsart, beschreibung: `Honorarnote ${nummer(h.jahr, h.laufnr)} · ${chiffre}` })
  const { error } = await sb().from('fin_honorarnote').update({ status: 'bezahlt', bezahlt_am: datum, buchung_id: buchungId }).eq('id', h.id)
  if (error) throw error
}

/** Stornieren: Nummer bleibt vergeben; eine bereits gebuchte Einnahme wird entfernt */
export async function stornieren(h: Honorarnote) {
  if (h.buchung_id) {
    const { error } = await sb().from('fin_buchung').delete().eq('id', h.buchung_id)
    if (error) throw error
  }
  const { error } = await sb().from('fin_honorarnote').update({ status: 'storniert', buchung_id: null }).eq('id', h.id)
  if (error) throw error
}

/** Sitzungen einer Akte, die abgeschlossen und noch nicht (nicht storniert) abgerechnet sind */
export function offeneSitzungen<T extends { id: string; akte_id: string; protokoll_status: string }>(sitzungen: T[], noten: Honorarnote[], akteId: string) {
  const abgerechnet = new Set(noten.filter((n) => n.status !== 'storniert').flatMap((n) => n.sitzung_ids))
  return sitzungen.filter((s) => s.akte_id === akteId && s.protokoll_status === 'abgeschlossen' && !abgerechnet.has(s.id))
}
