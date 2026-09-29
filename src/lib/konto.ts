'use client'
// Anmeldung, Einrichtung und Schlüsselbund – alles im Browser. Die Passphrase verlässt das Gerät nie;
// Supabase erhält nur das daraus abgeleitete Anmelde-Geheimnis (Lösungsdesign 4.2).
import { supabaseBrowser } from './supabase/client'
import { anmeldeGeheimnis, schluesselbundEinrichten, schluesselbundOeffnen, type KdfParameter, type SchluesselbundEintrag, type Tresorinhalt } from './crypto/kern'

export class AnmeldungFehlgeschlagen extends Error {
  constructor(meldung = 'E-Mail-Adresse oder Passphrase stimmen nicht.') { super(meldung) }
}

const sb = () => supabaseBrowser()

/** Schritt 1 der Anmeldung. Gibt die ID des TOTP-Faktors zurück (null = Konto noch nicht eingerichtet). */
export async function anmelden(email: string, passwort: string): Promise<{ faktorId: string | null }> {
  const { error } = await sb().auth.signInWithPassword({ email: email.trim().toLowerCase(), password: passwort })
  if (error) throw new AnmeldungFehlgeschlagen()
  return { faktorId: await verifizierterTotpFaktor() }
}

export async function anmeldenMitPassphrase(email: string, passphrase: string) {
  return anmelden(email, await anmeldeGeheimnis(passphrase, email))
}

export async function verifizierterTotpFaktor(): Promise<string | null> {
  const { data, error } = await sb().auth.mfa.listFactors()
  if (error) throw error
  return data.totp.find((f) => f.status === 'verified')?.id ?? null
}

/** Schritt 2: sechsstelliger Code aus der Authenticator-App → Sicherheitsstufe AAL2 */
export async function totpBestaetigen(faktorId: string, code: string) {
  const { error } = await sb().auth.mfa.challengeAndVerify({ factorId: faktorId, code: code.replace(/\s/g, '') })
  if (error) throw new AnmeldungFehlgeschlagen('Der Code stimmt nicht oder ist abgelaufen.')
}

export async function sicherheitsstufe(): Promise<{ angemeldet: boolean; aal2: boolean }> {
  const { data: { session } } = await sb().auth.getSession()
  if (!session) return { angemeldet: false, aal2: false }
  const { data } = await sb().auth.mfa.getAuthenticatorAssuranceLevel()
  return { angemeldet: true, aal2: data?.currentLevel === 'aal2' }
}

/** Rolle des angemeldeten Kontos (erst mit AAL2 lesbar) */
export async function rolle(): Promise<'beraterin' | 'support' | null> {
  const { data } = await sb().from('benutzer').select('rolle').maybeSingle()
  return (data?.rolle as 'beraterin' | 'support' | undefined) ?? null
}

/** Support-Konto (ICP) einrichten: nur Anmelde-Geheimnis setzen – es gibt keinen Schlüsselbund und damit keinen Zugriff auf Inhalte */
export async function supportEinrichten(email: string, passphrase: string) {
  const { error } = await sb().auth.updateUser({ password: await anmeldeGeheimnis(passphrase, email) })
  if (error) throw error
}

// ---------- Support-Freigabe (durch die Beraterin, befristet) ----------

export type Freigabe = { id: string; gueltig_bis: string; beendet_am: string | null; erstellt_am: string }

export async function ladeFreigaben(): Promise<Freigabe[]> {
  const { data, error } = await sb().from('support_freigabe').select('id, gueltig_bis, beendet_am, erstellt_am').order('erstellt_am', { ascending: false }).limit(10)
  if (error) throw error
  return data as Freigabe[]
}
export const aktiveFreigabe = (f: Freigabe[]) => f.find((x) => !x.beendet_am && new Date(x.gueltig_bis) > new Date()) ?? null

export async function freigeben(stunden: number) {
  const { data: b } = await sb().from('benutzer').select('praxis_id').single()
  const bis = new Date(Date.now() + stunden * 3600_000).toISOString()
  const { error } = await sb().from('support_freigabe').insert({ praxis_id: b!.praxis_id, gueltig_bis: bis })
  if (error) throw error
  await protokolliere('support_freigegeben', `${stunden} Std.`)
}

export async function freigabeBeenden(id: string) {
  const { error } = await sb().from('support_freigabe').update({ beendet_am: new Date().toISOString() }).eq('id', id)
  if (error) throw error
  await protokolliere('support_freigabe_beendet')
}

export async function ladeSchluesselbund(): Promise<SchluesselbundEintrag[]> {
  const { data, error } = await sb().from('schluesselbund').select('art, version, verpackt, kdf')
  if (error) throw error
  return (data ?? []).map((z) => ({ art: z.art, version: z.version, verpackt: z.verpackt, kdf: z.kdf as KdfParameter | null }))
}

export async function tresorOeffnen(passphrase: string): Promise<Tresorinhalt> {
  return schluesselbundOeffnen(await ladeSchluesselbund(), passphrase)
}

export async function abmelden(ueberall = false) {
  await sb().auth.signOut({ scope: ueberall ? 'global' : 'local' })
}

// ---------- Audit-Protokoll ----------

let praxisId: string | null = null
export async function protokolliere(ereignis: string, objekt?: string, ergebnis = 'ok') {
  try {
    if (!praxisId) {
      const { data } = await sb().from('benutzer').select('praxis_id').single()
      praxisId = data?.praxis_id ?? null
    }
    if (praxisId) await sb().from('audit_log').insert({ praxis_id: praxisId, ereignis, objekt, ergebnis })
  } catch { /* Audit darf die Bedienung nie blockieren */ }
}

export async function ladeAudit(anzahl = 25) {
  const { data, error } = await sb().from('audit_log').select('zeitpunkt, ereignis, objekt, ergebnis, user_id').order('zeitpunkt', { ascending: false }).limit(anzahl)
  if (error) throw error
  return data ?? []
}

// ---------- Einrichtung (einmalig, mit dem von ICP übergebenen Einrichtungscode) ----------

export async function totpAnlegen() {
  // Nicht abgeschlossene Versuche entfernen, sonst lehnt Supabase einen weiteren Faktor ab
  const { data: vorhanden } = await sb().auth.mfa.listFactors()
  for (const f of vorhanden?.all ?? []) if (f.status === 'unverified') await sb().auth.mfa.unenroll({ factorId: f.id })
  const { data, error } = await sb().auth.mfa.enroll({ factorType: 'totp', friendlyName: 'LSB Cockpit', issuer: 'LSB Cockpit' })
  if (error) throw error
  return { faktorId: data.id, qrCode: data.totp.qr_code, geheimnis: data.totp.secret }
}

/**
 * Nach TOTP (AAL2): Passwort auf das Anmelde-Geheimnis umstellen, Schlüssel erzeugen und verpackt speichern.
 * Gibt den Wiederherstellungscode zurück – er wird nirgends gespeichert und nur einmal angezeigt.
 */
export async function schluesselEinrichten(email: string, passphrase: string): Promise<string> {
  if ((await ladeSchluesselbund()).some((e) => e.art === 'master')) throw new Error('Für dieses Konto ist bereits ein Schlüsselbund eingerichtet.')
  const { data: { user } } = await sb().auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { eintraege, wiederherstellungscode } = await schluesselbundEinrichten(passphrase)
  const { error: fehlerSchluessel } = await sb().from('schluesselbund').insert(eintraege.map((e) => ({ ...e, user_id: user.id })))
  if (fehlerSchluessel) throw fehlerSchluessel

  const { error: fehlerPasswort } = await sb().auth.updateUser({ password: await anmeldeGeheimnis(passphrase, email) })
  if (fehlerPasswort) throw fehlerPasswort
  return wiederherstellungscode
}

export async function einrichtungAbschliessen() {
  const { data: { user } } = await sb().auth.getUser()
  if (!user) return
  await sb().from('benutzer').update({ eingerichtet_am: new Date().toISOString() }).eq('user_id', user.id)
  await protokolliere('einrichtung', 'schluesselbund v1')
}
