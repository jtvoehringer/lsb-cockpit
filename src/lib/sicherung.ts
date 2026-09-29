'use client'
// Verschlüsselter Gesamt-Export (F-16): alle Datensätze der Praxis (wie gespeichert, also Chiffretext + Metadaten),
// die verpackten Schlüssel und alle verschlüsselten Dateien – das Ganze zusätzlich mit einem Export-Schlüssel verschlüsselt.
// Der Export-Schlüssel liegt mit K_A verschlüsselt im Kopf. Öffnen lässt sich die Datei daher nur mit dem Master-Schlüssel
// (eingerichtetes Gerät, Notfallblatt oder Passphrase) – die verpackten Schlüssel stehen im Kopf.
import { aad, entschluessele, entschluesseleBytes, neuerZonenSchluessel, verschluessele, verschluesseleBytes } from './crypto/kern'
import { ausBase64, utf8, zuBase64 } from './crypto/kodierung'
import { supabaseBrowser } from './supabase/client'

import type { SupabaseClient } from '@supabase/supabase-js'

// Standard: Browser-Client; der E2E-Test übergibt einen eigenen Client (Node)
let client: SupabaseClient | null = null
const sb = () => client ?? supabaseBrowser()
export function mitClient(c: SupabaseClient | null) { client = c }
const FORMAT = 'lsb-cockpit-export'
const AAD_INHALT = 'lsb:export:v1:inhalt'

export const EXPORT_TABELLEN = [
  'praxis', 'akte', 'sitzung', 'protokoll_version', 'register_eintrag', 'stammdaten', 'stammdaten_dokument',
  'fin_kategorie', 'fin_buchung', 'fin_beleg', 'fin_honorarnote', 'loeschprotokoll', 'support_freigabe', 'audit_log',
] as const
const DATEIEN: { bucket: string; tabelle: string }[] = [{ bucket: 'belege', tabelle: 'fin_beleg' }, { bucket: 'dokumente', tabelle: 'stammdaten_dokument' }]

type Zeile = Record<string, unknown>
export type ExportKopf = {
  format: typeof FORMAT; version: 1; export_id: string; erstellt_am: string
  schluesselbund: Zeile[]; passkey_schluessel: Zeile[]; exportschluessel_enc: string
}
export type ExportDatei = { kopf: ExportKopf; inhalt: string }
export type ExportInhalt = { tabellen: Record<string, Zeile[]>; dateien: { bucket: string; pfad: string; daten: string }[] }

async function alle(tabelle: string): Promise<Zeile[]> {
  const out: Zeile[] = []
  for (let von = 0; ; von += 1000) {
    const { data, error } = await sb().from(tabelle).select('*').range(von, von + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

export async function erstelleExport(kA: CryptoKey, fortschritt: (t: string) => void = () => {}): Promise<Blob> {
  const tabellen: Record<string, Zeile[]> = {}
  for (const t of EXPORT_TABELLEN) { fortschritt(`Tabelle ${t} …`); tabellen[t] = await alle(t) }
  const dateien: ExportInhalt['dateien'] = []
  for (const { bucket, tabelle } of DATEIEN) {
    for (const z of tabellen[tabelle]) {
      const pfad = String(z.pfad)
      fortschritt(`Datei ${dateien.length + 1} …`)
      const { data, error } = await sb().storage.from(bucket).download(pfad)
      if (error) throw error
      dateien.push({ bucket, pfad, daten: zuBase64(new Uint8Array(await data.arrayBuffer())) })
    }
  }
  fortschritt('Verschlüsseln …')
  const exportSchluessel = await neuerZonenSchluessel()
  const roh = zuBase64(new Uint8Array(await crypto.subtle.exportKey('raw', exportSchluessel)))
  const export_id = crypto.randomUUID()
  const inhalt = await verschluesseleBytes(exportSchluessel, utf8(JSON.stringify({ tabellen, dateien } satisfies ExportInhalt)), AAD_INHALT + ':' + export_id)
  const kopf: ExportKopf = {
    format: FORMAT, version: 1, export_id, erstellt_am: new Date().toISOString(),
    schluesselbund: await alle('schluesselbund'), passkey_schluessel: await alle('passkey_schluessel'),
    exportschluessel_enc: await verschluessele(kA, roh, aad('export', export_id, 'schluessel')),
  }
  return new Blob([JSON.stringify({ kopf, inhalt: zuBase64(inhalt) } satisfies ExportDatei)], { type: 'application/json' })
}

/** Öffnet eine Exportdatei mit dem aktuellen K_A und liefert eine Übersicht (Prüfung, dass sie vollständig lesbar ist). */
export async function pruefeExport(kA: CryptoKey, datei: File): Promise<{ erstellt_am: string; tabellen: Record<string, number>; dateien: number; bytes: number }> {
  let d: ExportDatei
  try { d = JSON.parse(await datei.text()) } catch { throw new Error('Keine gültige Exportdatei.') }
  if (d?.kopf?.format !== FORMAT || d.kopf.version !== 1) throw new Error('Keine Exportdatei des LSB Cockpit.')
  let roh: string
  try { roh = await entschluessele(kA, d.kopf.exportschluessel_enc, aad('export', d.kopf.export_id, 'schluessel')) }
  catch { throw new Error('Der Export gehört zu einem anderen Schlüsselbund oder ist beschädigt.') }
  let klar: ArrayBuffer, inhalt: ExportInhalt
  try {
    const k = await crypto.subtle.importKey('raw', ausBase64(roh), { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
    klar = await entschluesseleBytes(k, ausBase64(d.inhalt), AAD_INHALT + ':' + d.kopf.export_id)
    inhalt = JSON.parse(new TextDecoder().decode(klar)) as ExportInhalt
  } catch { throw new Error('Die Exportdatei ist beschädigt oder wurde verändert – Inhalt nicht lesbar.') }
  return {
    erstellt_am: d.kopf.erstellt_am,
    tabellen: Object.fromEntries(Object.entries(inhalt.tabellen).map(([t, z]) => [t, z.length])),
    dateien: inhalt.dateien.length,
    bytes: klar.byteLength,
  }
}
