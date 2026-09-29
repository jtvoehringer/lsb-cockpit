'use client'
// Akten abschließen, wieder öffnen und nach Fristablauf löschen (R-09, F-08).
// Reihenfolge der Löschung: verschlüsselte Dokument-Dateien (Speicher) → in einer Transaktion Zone B (Protokolle,
// Sitzungen), Zone A (Stammdaten), Zone C (Registereintrag) → Akte bleibt als „geloescht“ mit Chiffre, Löschprotokoll.
import { berechneAufbewahrung, type FristEinstellungen, type FristErgebnis } from './fristen'
import { ladeRegister, type Akte } from './protokolle/daten'
import { dokumentLoeschen, gueltigeEinwilligung, ladeDokumente, ladeStammdaten } from './stammdaten'
import { supabaseBrowser } from './supabase/client'

const sb = () => supabaseBrowser()

/** Frist für eine Akte aus den (verschlüsselten) Stammdaten berechnen – nur im Browser. */
export async function fristFuerAkte(kA: CryptoKey, kC: CryptoKey, akte: Akte, abschluss: string, e: FristEinstellungen): Promise<FristErgebnis> {
  const reg = (await ladeRegister(kC)).find((r) => r.akte_id === akte.id)
  const st = reg?.stammdaten_id ? await ladeStammdaten(kA, reg.stammdaten_id) : null
  return berechneAufbewahrung({
    abschluss,
    minderjaehrig: st?.minderjaehrig,
    geburtsjahr: st?.geburtsjahr,
    zustimmung: !!(st && gueltigeEinwilligung(st, 'aufbewahrung', abschluss)),
  }, e)
}

export async function akteAbschliessen(akteId: string, abschluss: string, bis: string) {
  const { error } = await sb().from('akte').update({ status: 'abgeschlossen', abschluss_datum: abschluss, aufbewahrung_bis: bis }).eq('id', akteId)
  if (error) throw error
}

export async function akteWiederOeffnen(akteId: string) {
  const { error } = await sb().from('akte').update({ status: 'offen', abschluss_datum: null, aufbewahrung_bis: null }).eq('id', akteId)
  if (error) throw error
}

export type LoeschUmfang = { protokollfassungen: number; sitzungen: number; stammdaten: number; registereintrag: number; dokumente: number }

export async function akteLoeschen(kA: CryptoKey, kC: CryptoKey, akte: Akte): Promise<LoeschUmfang> {
  const reg = (await ladeRegister(kC)).find((r) => r.akte_id === akte.id)
  let dokumente = 0
  if (reg?.stammdaten_id) {
    for (const d of await ladeDokumente(kA, reg.stammdaten_id)) { await dokumentLoeschen(d); dokumente++ }
  }
  const { data, error } = await sb().rpc('akte_loeschen', { p_akte: akte.id, p_register: reg?.id ?? null, p_stammdaten: reg?.stammdaten_id ?? null })
  if (error) throw error
  return { ...(data as Omit<LoeschUmfang, 'dokumente'>), dokumente }
}

export type LoeschEintrag = { id: string; chiffre: string; abschluss_datum: string | null; aufbewahrung_bis: string | null; geloescht_am: string; umfang: Record<string, number> }

export async function ladeLoeschprotokoll(): Promise<LoeschEintrag[]> {
  const { data, error } = await sb().from('loeschprotokoll').select('id, chiffre, abschluss_datum, aufbewahrung_bis, geloescht_am, umfang').order('geloescht_am', { ascending: false })
  if (error) throw error
  return data as LoeschEintrag[]
}
