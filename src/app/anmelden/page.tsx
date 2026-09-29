'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Bestaetigung } from '@/components/Bestaetigung'
import { SchmalerRahmen } from '@/components/Rahmen'
import { FalschePassphrase } from '@/lib/crypto/kern'
import {
  anmeldenMitPassphrase, emailCodeAnfordern, emailCodeBestaetigen, hatSchluesselbund, ladeSchluesselbund, protokolliere, rolle,
  sicherheitsstufe, totpBestaetigen, tresorOeffnen, verifizierterTotpFaktor,
} from '@/lib/konto'
import { useTresor } from '@/lib/tresor'

// Anmeldung (Variante A): E-Mail-Code → Code aus der Authenticator-App (AAL2) → Entsperren mit Passkey oder Passphrase.
// Die Passphrase-Anmeldung bleibt als Ausweichweg (und für die fiktiven Testkonten, deren Adressen keine Post empfangen).
type Schritt = 'email' | 'emailcode' | 'passphrase' | 'totp' | 'entsperren'

const UNTERTITEL: Record<Schritt, string> = {
  email: 'Mit deiner E-Mail-Adresse – du bekommst einen Code zugeschickt.',
  emailcode: 'Code aus der E-Mail eingeben.',
  passphrase: 'Mit E-Mail-Adresse und Passphrase.',
  totp: 'Sechsstelliger Code aus der Authenticator-App.',
  entsperren: 'Angemeldet – jetzt entsperren.',
}

export default function Anmelden() {
  const router = useRouter()
  const tresor = useTresor()
  const [schritt, setSchritt] = useState<Schritt>('email')
  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [code, setCode] = useState('')
  const [faktorId, setFaktorId] = useState<string | null>(null)
  const [arbeitet, setArbeitet] = useState<string | null>(null)
  const [fehler, setFehler] = useState('')
  const [hinweis, setHinweis] = useState('')

  // Bereits angemeldet (z. B. nach Neuladen)? Dann gleich beim richtigen Schritt weitermachen.
  useEffect(() => {
    void sicherheitsstufe().then(async ({ angemeldet, aal2 }) => {
      if (aal2) { router.replace('/entsperren'); return }
      if (angemeldet) { const f = await verifizierterTotpFaktor(); if (f) { setFaktorId(f); setSchritt('totp') } }
    })
  }, [router])

  async function codeAnfordern(e?: React.FormEvent) {
    e?.preventDefault()
    setFehler(''); setHinweis(''); setArbeitet('Code wird verschickt …')
    try {
      await emailCodeAnfordern(email)
      setSchritt('emailcode')
      setHinweis(`Falls ${email.trim()} hier ein Konto hat, ist ein Code unterwegs. Er gilt 10 Minuten. Bitte auch im Spam-Ordner nachsehen.`)
    } catch (err) { setFehler((err as Error).message) } finally { setArbeitet(null) }
  }

  async function emailCodePruefen(e: React.FormEvent) {
    e.preventDefault()
    setFehler(''); setArbeitet('Wird geprüft …')
    try {
      const { faktorId } = await emailCodeBestaetigen(email, emailCode)
      if (!faktorId) { router.replace('/einrichten'); return }
      setFaktorId(faktorId); setHinweis(''); setSchritt('totp')
    } catch (err) { setFehler((err as Error).message); setEmailCode('') } finally { setArbeitet(null) }
  }

  async function mitPassphrase(e: React.FormEvent) {
    e.preventDefault()
    setFehler(''); setArbeitet('Schlüssel wird abgeleitet …')
    try {
      const { faktorId } = await anmeldenMitPassphrase(email, passphrase)
      if (!faktorId) { router.replace('/einrichten'); return }
      setFaktorId(faktorId); setSchritt('totp')
    } catch (err) { setFehler((err as Error).message) } finally { setArbeitet(null) }
  }

  async function totpPruefen(e: React.FormEvent) {
    e.preventDefault()
    setFehler(''); setArbeitet('Wird geprüft …')
    try {
      await totpBestaetigen(faktorId!, code)
      if ((await rolle()) === 'support') { setPassphrase(''); router.replace('/support'); return }
      if (!hatSchluesselbund(await ladeSchluesselbund())) { router.replace('/einrichten'); return }
      if (passphrase) {
        // Mit Passphrase angemeldet: gleich damit entsperren
        setArbeitet('Tresor wird geöffnet …')
        tresor.oeffnen(await tresorOeffnen(passphrase))
        setPassphrase('')
        await protokolliere('anmeldung', 'Passphrase')
        router.replace('/')
        return
      }
      setSchritt('entsperren')
    } catch (err) {
      setFehler(err instanceof FalschePassphrase ? 'Passphrase stimmt nicht.' : (err as Error).message)
      setCode('')
    } finally { setArbeitet(null) }
  }

  const knopf = (text: string) => <button className="btn btn-cta w-full" disabled={!!arbeitet}>{arbeitet ?? text}</button>
  const link = (text: string, ziel: Schritt) => (
    <button type="button" className="text-sm text-text-muted underline" onClick={() => { setFehler(''); setHinweis(''); setSchritt(ziel) }}>{text}</button>
  )

  return (
    <SchmalerRahmen titel="Anmelden" untertitel={UNTERTITEL[schritt]}>
      {schritt === 'email' && (
        <form onSubmit={codeAnfordern} className="space-y-5">
          <label>E-Mail-Adresse<input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <p className="fehler" role="alert">{fehler}</p>
          {knopf('Code zuschicken')}
          <div className="flex flex-wrap justify-between gap-2">
            {link('Stattdessen mit Passphrase anmelden', 'passphrase')}
            <a href="/einrichten" className="text-sm text-text-muted underline">Erstmals hier? Konto einrichten</a>
          </div>
        </form>
      )}

      {schritt === 'emailcode' && (
        <form onSubmit={emailCodePruefen} className="space-y-5">
          {hinweis && <p className="text-sm text-text-muted">{hinweis}</p>}
          <label>Code aus der E-Mail<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,10}" required autoFocus value={emailCode} onChange={(e) => setEmailCode(e.target.value)} className="code" /></label>
          <p className="fehler" role="alert">{fehler}</p>
          {knopf('Weiter')}
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className="text-sm text-text-muted underline" disabled={!!arbeitet} onClick={() => void codeAnfordern()}>Neuen Code schicken</button>
            {link('Andere E-Mail-Adresse', 'email')}
          </div>
        </form>
      )}

      {schritt === 'passphrase' && (
        <form onSubmit={mitPassphrase} className="space-y-5">
          <label>E-Mail-Adresse<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Passphrase<input type="password" autoComplete="current-password" required autoFocus value={passphrase} onChange={(e) => setPassphrase(e.target.value)} /></label>
          <p className="fehler" role="alert">{fehler}</p>
          {knopf('Weiter')}
          {link('Zurück zur Anmeldung mit E-Mail-Code', 'email')}
        </form>
      )}

      {schritt === 'totp' && (
        <form onSubmit={totpPruefen} className="space-y-5">
          <label>Code aus der Authenticator-App<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} className="code" /></label>
          <p className="fehler" role="alert">{fehler}</p>
          {knopf('Anmelden')}
        </form>
      )}

      {schritt === 'entsperren' && (
        <Bestaetigung knopf="Entsperren" ereignis="entsperren" autoFocus weiter={async (t, mittel) => {
          tresor.oeffnen(t)
          await protokolliere('anmeldung', mittel === 'passkey' ? 'E-Mail-Code + Passkey' : 'E-Mail-Code + Passphrase')
          router.replace('/')
        }} />
      )}

      <p className="mt-10 text-sm text-text-muted">
        Kein Zugriff mehr auf Handy oder Passphrase? Ein Zurücksetzen per E-Mail gibt es bewusst nicht – sonst wären die Daten nicht geschützt. Der Weg zurück führt über das Notfallblatt; bitte ICP kontaktieren.
      </p>
    </SchmalerRahmen>
  )
}
