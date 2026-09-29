'use client'
// Praxis-Einstellungen (Absender und Bankdaten für Honorarnoten, Honorarsatz). Keine Klientendaten → im Klartext in praxis.einstellungen.
import { supabaseBrowser } from './supabase/client'
import { FRISTEN_STANDARD, type FristEinstellungen } from './fristen'
import { praxis } from './protokolle/daten'

export type PraxisEinstellungen = {
  name: string; berufsbezeichnung: string; strasse: string; plz_ort: string; telefon: string; email: string
  iban: string; bic: string; bank: string; honorarsatz: number; zahlungsziel_tage: number; hinweis: string
}

export const KLEINUNTERNEHMER_HINWEIS = 'Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung gemäß § 6 Abs. 1 Z 27 UStG.'

export const LEER: PraxisEinstellungen = {
  name: '', berufsbezeichnung: 'Lebens- und Sozialberatung', strasse: '', plz_ort: '', telefon: '', email: '',
  iban: '', bic: '', bank: '', honorarsatz: 0, zahlungsziel_tage: 14, hinweis: KLEINUNTERNEHMER_HINWEIS,
}

export async function ladeEinstellungen(): Promise<PraxisEinstellungen> {
  const p = await praxis()
  const { data, error } = await supabaseBrowser().from('praxis').select('einstellungen').eq('id', p.id).single()
  if (error) throw error
  return { ...LEER, ...((data?.einstellungen as { honorarnote?: Partial<PraxisEinstellungen> })?.honorarnote ?? {}) }
}

export async function speichereEinstellungen(e: PraxisEinstellungen) {
  const p = await praxis()
  const { data } = await supabaseBrowser().from('praxis').select('einstellungen').eq('id', p.id).single()
  const alt = (data?.einstellungen ?? {}) as Record<string, unknown>
  const { error } = await supabaseBrowser().from('praxis').update({ einstellungen: { ...alt, honorarnote: e } }).eq('id', p.id)
  if (error) throw error
}

// ---------- Aufbewahrungsfristen (praxis.einstellungen.fristen) ----------

export async function ladeFristen(): Promise<FristEinstellungen> {
  const p = await praxis()
  const { data, error } = await supabaseBrowser().from('praxis').select('einstellungen').eq('id', p.id).single()
  if (error) throw error
  return { ...FRISTEN_STANDARD, ...((data?.einstellungen as { fristen?: Partial<FristEinstellungen> })?.fristen ?? {}) }
}

export async function speichereFristen(f: FristEinstellungen) {
  const p = await praxis()
  const { data } = await supabaseBrowser().from('praxis').select('einstellungen').eq('id', p.id).single()
  const alt = (data?.einstellungen ?? {}) as Record<string, unknown>
  const { error } = await supabaseBrowser().from('praxis').update({ einstellungen: { ...alt, fristen: f } }).eq('id', p.id)
  if (error) throw error
}

/** IBAN grob prüfen (Länge, Prüfziffer nach ISO 13616) */
export function ibanGueltig(iban: string): boolean {
  const s = iban.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false
  const umgestellt = s.slice(4) + s.slice(0, 4)
  let rest = 0
  for (const c of umgestellt) {
    const wert = c >= 'A' ? String(c.charCodeAt(0) - 55) : c
    for (const z of wert) rest = (rest * 10 + Number(z)) % 97
  }
  return rest === 1
}

export const ibanFormatiert = (iban: string) => iban.replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim()
