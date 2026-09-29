'use client'
// WebAuthn-Passkey mit PRF-Erweiterung (Windows Hello / Face ID). Kein Server-Abgleich der Signatur nötig:
// Sicherheit ergibt sich allein daraus, dass nur das Gerät nach Freigabe die PRF-Bytes liefern kann.
// Getestet am 29.09.2026 auf Melanies Laptop (Chrome, Windows Hello) und iPhone (iOS 26).
import { ausBase64, utf8, zuBase64Url } from './crypto/kodierung'

export class PasskeyAbgebrochen extends Error {
  constructor() { super('Abgebrochen oder nicht bestätigt.') }
}

// Gleiche PRF-Eingabe für alle Passkeys; jeder Passkey hat ein eigenes Geheimnis, daher trotzdem je Gerät verschiedene Schlüssel.
const prfEingabe = async () => new Uint8Array(await crypto.subtle.digest('SHA-256', utf8('lsb-cockpit/passkey-prf/v1')))

const ausBase64Url = (s: string) => ausBase64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))

type PrfErgebnis = { results?: { first?: ArrayBuffer } }

/** Unterstützt dieser Browser Passkeys mit PRF? (vorsichtig: ohne Fähigkeitsabfrage nur „vielleicht“) */
export async function passkeyMoeglich(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
  const pkc = PublicKeyCredential as unknown as { getClientCapabilities?: () => Promise<Record<string, boolean>> }
  try {
    if (pkc.getClientCapabilities) return (await pkc.getClientCapabilities())['extension:prf'] === true
  } catch { /* weiter unten */ }
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
}

function fehler(e: unknown): never {
  if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) throw new PasskeyAbgebrochen()
  if (e instanceof DOMException && e.name === 'InvalidStateError') throw new Error('Auf diesem Gerät ist bereits ein Passkey für das Cockpit eingerichtet.')
  if (e instanceof DOMException && e.name === 'NotSupportedError') throw new Error('Dieses Gerät unterstützt keine Passkeys.')
  throw e
}

/** Neuen Passkey anlegen und die PRF-Bytes holen (falls nicht gleich geliefert: sofort eine Bestätigung nachschieben). */
export type PasskeyZiel = 'geraet' | 'handy'

/** ziel „geraet“: Windows Hello / Face ID dieses Geräts; „handy“: ein anderes Gerät per QR-Code (z. B. das iPhone vom Laptop aus). */
export async function passkeyAnlegen(benutzer: { id: string; email: string }, vorhandene: string[], ziel: PasskeyZiel = 'geraet'): Promise<{ credentialId: string; prf: ArrayBuffer }> {
  const eingabe = await prfEingabe()
  let cred: PublicKeyCredential
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        rp: { id: location.hostname, name: 'LSB Cockpit' },
        user: { id: utf8(benutzer.id), name: benutzer.email, displayName: benutzer.email },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: ziel === 'geraet' ? 'platform' : 'cross-platform' },
        excludeCredentials: vorhandene.map((id) => ({ type: 'public-key' as const, id: ausBase64Url(id) })),
        timeout: 180_000,
        extensions: { prf: { eval: { first: eingabe } } } as AuthenticationExtensionsClientInputs,
        ...({ hints: [ziel === 'geraet' ? 'client-device' : 'hybrid'] } as object),
      },
    })) as PublicKeyCredential
  } catch (e) { fehler(e) }
  const credentialId = zuBase64Url(cred.rawId)
  const ext = cred.getClientExtensionResults() as { prf?: PrfErgebnis & { enabled?: boolean } }
  if (ext.prf?.enabled === false) throw new Error('Dieses Gerät unterstützt das Entsperren per Passkey nicht (PRF fehlt).')
  const sofort = ext.prf?.results?.first
  if (sofort) return { credentialId, prf: sofort }
  return { credentialId, prf: (await passkeyBestaetigen([credentialId])).prf }
}

/** Passkey bestätigen lassen (Windows Hello / Face ID) und die PRF-Bytes des gewählten Passkeys liefern. */
export async function passkeyBestaetigen(erlaubt: string[]): Promise<{ credentialId: string; prf: ArrayBuffer }> {
  const eingabe = await prfEingabe()
  let cred: PublicKeyCredential
  try {
    cred = (await navigator.credentials.get({
      publicKey: {
        rpId: location.hostname,
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: erlaubt.map((id) => ({ type: 'public-key' as const, id: ausBase64Url(id) })),
        userVerification: 'required',
        timeout: 120_000,
        extensions: { prf: { eval: { first: eingabe } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential
  } catch (e) { fehler(e) }
  const prf = (cred.getClientExtensionResults() as { prf?: PrfErgebnis }).prf?.results?.first
  if (!prf) throw new Error('Das Gerät hat keinen Schlüssel geliefert (PRF). Bitte mit der Passphrase entsperren.')
  return { credentialId: zuBase64Url(cred.rawId), prf }
}

/** Vorschlag für die Gerätebezeichnung */
export function geraetVorschlag(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android-Handy'
  if (/Windows/.test(ua)) return 'Windows-Laptop'
  if (/Mac OS/.test(ua)) return 'Mac'
  return 'Gerät'
}
