'use client'
// Anmeldung, Einrichtung und Schlüsselbund – alles im Browser. Die Passphrase verlässt das Gerät nie;
// Supabase erhält nur das daraus abgeleitete Anmelde-Geheimnis (Lösungsdesign 4.2).
import { supabaseBrowser } from './supabase/client'
import {
  anmeldeGeheimnis, entpackeMaster, kekAusPrf, masterMitNotfallcode, masterMitPassphrase, neuePasskeyParameter, schluesselbundEinrichten,
  schluesselbundErzeugen, schluesselbundOeffnen, tresorAusMaster, verpacke, type KdfParameter, type SchluesselbundEintrag, type Tresorinhalt,
} from './crypto/kern'
import { zuBase64Url } from './crypto/kodierung'
import { passkeyAnlegen, passkeyBestaetigen, type PasskeyZiel } from './passkey'

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

/** Anmeldung per E-Mail-Code, Schritt 1: Code anfordern (nur für bestehende Konten; Versand über Brevo-SMTP). */
export async function emailCodeAnfordern(email: string) {
  const { error } = await sb().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } })
  // Keine Auskunft, ob ein Konto existiert – nur Wartezeit/Versandfehler melden
  if (error && /rate|seconds|security purposes/i.test(error.message)) throw new AnmeldungFehlgeschlagen('Bitte kurz warten und dann einen neuen Code anfordern.')
  if (error && error.status !== 400 && error.status !== 422) throw new AnmeldungFehlgeschlagen('Der Code konnte nicht verschickt werden. Bitte später nochmals versuchen.')
}

/** Schritt 2: Code aus der E-Mail prüfen. Gibt die ID des TOTP-Faktors zurück (null = Konto noch nicht eingerichtet). */
export async function emailCodeBestaetigen(email: string, code: string): Promise<{ faktorId: string | null }> {
  const { error } = await sb().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\s/g, ''), type: 'email' })
  if (error) throw new AnmeldungFehlgeschlagen('Der Code stimmt nicht oder ist abgelaufen.')
  return { faktorId: await verifizierterTotpFaktor() }
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

/** Support-Konto (ICP) einrichten: kein Schlüsselbund (also kein Zugriff auf Inhalte); Anmeldung ab jetzt per E-Mail-Code. */
export async function supportEinrichten() {
  await passwortUnbrauchbarMachen()
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

// ---------- Passkeys (Entsperren mit Windows Hello / Face ID) ----------

export type PasskeyEintrag = { id: string; credential_id: string; bezeichnung: string; verpackt: string; kdf: KdfParameter; erstellt_am: string }

export async function ladePasskeys(): Promise<PasskeyEintrag[]> {
  const { data, error } = await sb().from('passkey_schluessel').select('id, credential_id, bezeichnung, verpackt, kdf, erstellt_am').order('erstellt_am')
  if (error) throw error
  return (data ?? []) as PasskeyEintrag[]
}

/** Womit der Zugriff bestätigt wird, bevor ein neues Gerät eine Kopie des Master-Schlüssels bekommt. */
export type Nachweis = { art: 'passkey' } | { art: 'passphrase'; wert: string } | { art: 'notfall'; wert: string }

/** Master-Schlüssel exportierbar entpacken – nur, um ihn für ein neues Gerät neu zu verpacken. */
export async function masterFuerNeuesGeraet(n: Nachweis): Promise<CryptoKey> {
  const bund = await ladeSchluesselbund()
  if (n.art === 'passphrase') return masterMitPassphrase(bund, n.wert, true)
  if (n.art === 'notfall') return masterMitNotfallcode(bund, n.wert, true)
  return masterMitPasskey(await ladePasskeys(), true)
}

/** Passkey anlegen (dieses Gerät oder Handy per QR-Code) und den Master-Schlüssel dafür verpacken. */
export async function passkeyEinrichten(master: CryptoKey, bezeichnung: string, ziel: PasskeyZiel = 'geraet') {
  const { data: { user } } = await sb().auth.getUser()
  if (!user?.email) throw new Error('Nicht angemeldet')
  const vorhandene = await ladePasskeys()
  const { credentialId, prf } = await passkeyAnlegen({ id: user.id, email: user.email }, vorhandene.map((p) => p.credential_id), ziel)
  const kdf = neuePasskeyParameter()
  const verpackt = await verpacke(master, await kekAusPrf(prf, kdf))
  const name = bezeichnung.trim().slice(0, 60) || 'Gerät'
  const { error } = await sb().from('passkey_schluessel').insert({ credential_id: credentialId, bezeichnung: name, verpackt, kdf })
  if (error) throw error
  await protokolliere('passkey_eingerichtet', name)
}

async function masterMitPasskey(liste: PasskeyEintrag[], exportierbar = false): Promise<CryptoKey> {
  if (!liste.length) throw new Error('Auf diesem Konto ist noch kein Passkey eingerichtet.')
  const { credentialId, prf } = await passkeyBestaetigen(liste.map((p) => p.credential_id))
  const p = liste.find((x) => x.credential_id === credentialId)
  if (!p) throw new Error('Unbekannter Passkey.')
  try { return await entpackeMaster(p.verpackt, await kekAusPrf(prf, p.kdf), exportierbar) }
  catch { throw new Error('Der Passkey passt nicht zum Schlüsselbund. Bitte mit dem Notfallblatt entsperren.') }
}

/** Tresor mit dem Wiederherstellungscode vom Notfallblatt öffnen. */
export async function tresorOeffnenMitNotfallcode(code: string): Promise<Tresorinhalt> {
  const bund = await ladeSchluesselbund()
  const t = await tresorAusMaster(bund, await masterMitNotfallcode(bund, code))
  await protokolliere('notfallcode_verwendet')
  return t
}

/** Hat das Konto eine Passphrase? (bei Einrichtung mit Passkey nicht) */
export const hatPassphrase = (bund: SchluesselbundEintrag[]) => bund.some((e) => e.art === 'master')
/** Ist der Schlüsselbund eingerichtet? (Notfall-Kopie gibt es in jeder Variante) */
export const hatSchluesselbund = (bund: SchluesselbundEintrag[]) => bund.some((e) => e.art === 'notfall')

export async function passkeyEntfernen(p: PasskeyEintrag) {
  const { error } = await sb().from('passkey_schluessel').delete().eq('id', p.id)
  if (error) throw error
  await protokolliere('passkey_entfernt', p.bezeichnung)
}

/** Tresor mit einem Passkey öffnen (wirft PasskeyAbgebrochen, wenn abgebrochen). */
export async function tresorOeffnenMitPasskey(passkeys?: PasskeyEintrag[]): Promise<Tresorinhalt> {
  const master = await masterMitPasskey(passkeys ?? await ladePasskeys())
  return tresorAusMaster(await ladeSchluesselbund(), master)
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
  if (hatSchluesselbund(await ladeSchluesselbund())) throw new Error('Für dieses Konto ist bereits ein Schlüsselbund eingerichtet.')
  const { data: { user } } = await sb().auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { eintraege, wiederherstellungscode } = await schluesselbundEinrichten(passphrase)
  const { error: fehlerSchluessel } = await sb().from('schluesselbund').insert(eintraege.map((e) => ({ ...e, user_id: user.id })))
  if (fehlerSchluessel) throw fehlerSchluessel

  const { error: fehlerPasswort } = await sb().auth.updateUser({ password: await anmeldeGeheimnis(passphrase, email) })
  if (fehlerPasswort) throw fehlerPasswort
  return wiederherstellungscode
}

/**
 * Einrichtung ohne Passphrase (Standard): zuerst den Passkey anlegen (bricht die Beraterin ab, entsteht nichts),
 * dann Schlüssel erzeugen – Master verpackt für Passkey und Notfallblatt. Das Einrichtungscode-Passwort wird durch
 * Zufall ersetzt; angemeldet wird ab jetzt per E-Mail-Code.
 */
export async function schluesselEinrichtenMitPasskey(bezeichnung: string): Promise<{ wiederherstellungscode: string; tresor: Tresorinhalt }> {
  if (hatSchluesselbund(await ladeSchluesselbund())) throw new Error('Für dieses Konto ist bereits ein Schlüsselbund eingerichtet.')
  const { data: { user } } = await sb().auth.getUser()
  if (!user?.email) throw new Error('Nicht angemeldet')

  const { credentialId, prf } = await passkeyAnlegen({ id: user.id, email: user.email }, [], 'geraet')
  const { master, eintraege, wiederherstellungscode } = await schluesselbundErzeugen()
  const kdf = neuePasskeyParameter()
  const verpackt = await verpacke(master, await kekAusPrf(prf, kdf))

  const { error: e1 } = await sb().from('schluesselbund').insert(eintraege.map((e) => ({ ...e, user_id: user.id })))
  if (e1) throw e1
  const name = bezeichnung.trim().slice(0, 60) || 'Gerät'
  const { error: e2 } = await sb().from('passkey_schluessel').insert({ credential_id: credentialId, bezeichnung: name, verpackt, kdf })
  if (e2) throw e2
  await protokolliere('passkey_eingerichtet', name)
  await passwortUnbrauchbarMachen()
  return { wiederherstellungscode, tresor: await tresorAusMaster(eintraege, master) }
}

/** Anmeldung nur noch per E-Mail-Code: das Supabase-Passwort (Einrichtungscode) durch unbekannten Zufall ersetzen. */
async function passwortUnbrauchbarMachen() {
  const { error } = await sb().auth.updateUser({ password: zuBase64Url(crypto.getRandomValues(new Uint8Array(32))) })
  if (error) throw error
}

export async function einrichtungAbschliessen() {
  const { data: { user } } = await sb().auth.getUser()
  if (!user) return
  await sb().from('benutzer').update({ eingerichtet_am: new Date().toISOString() }).eq('user_id', user.id)
  await protokolliere('einrichtung', 'schluesselbund v1')
}
