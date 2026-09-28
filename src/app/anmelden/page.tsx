'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SchmalerRahmen } from '@/components/Rahmen'
import { FalschePassphrase } from '@/lib/crypto/kern'
import { anmeldenMitPassphrase, ladeSchluesselbund, protokolliere, totpBestaetigen, tresorOeffnen } from '@/lib/konto'
import { useTresor } from '@/lib/tresor'

export default function Anmelden() {
  const router = useRouter()
  const tresor = useTresor()
  const [schritt, setSchritt] = useState<'passphrase' | 'totp'>('passphrase')
  const [email, setEmail] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [code, setCode] = useState('')
  const [faktorId, setFaktorId] = useState<string | null>(null)
  const [arbeitet, setArbeitet] = useState<string | null>(null)
  const [fehler, setFehler] = useState('')

  async function schritt1(e: React.FormEvent) {
    e.preventDefault()
    setFehler(''); setArbeitet('Schlüssel wird abgeleitet …')
    try {
      const { faktorId } = await anmeldenMitPassphrase(email, passphrase)
      if (!faktorId) { router.replace('/einrichten'); return }
      setFaktorId(faktorId); setSchritt('totp')
    } catch (err) {
      setFehler((err as Error).message)
    } finally { setArbeitet(null) }
  }

  async function schritt2(e: React.FormEvent) {
    e.preventDefault()
    setFehler(''); setArbeitet('Wird geprüft …')
    try {
      await totpBestaetigen(faktorId!, code)
      setArbeitet('Tresor wird geöffnet …')
      if (!(await ladeSchluesselbund()).some((s) => s.art === 'master')) { router.replace('/einrichten'); return }
      tresor.oeffnen(await tresorOeffnen(passphrase))
      setPassphrase('')
      await protokolliere('anmeldung')
      router.replace('/')
    } catch (err) {
      setFehler(err instanceof FalschePassphrase ? 'Passphrase stimmt nicht.' : (err as Error).message)
      setCode('')
    } finally { setArbeitet(null) }
  }

  return (
    <SchmalerRahmen titel="Anmelden" untertitel={schritt === 'passphrase' ? 'Mit E-Mail-Adresse und Passphrase.' : 'Sechsstelliger Code aus der Authenticator-App.'}>
      {schritt === 'passphrase' ? (
        <form onSubmit={schritt1} className="space-y-5">
          <label>E-Mail-Adresse<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Passphrase<input type="password" autoComplete="current-password" required value={passphrase} onChange={(e) => setPassphrase(e.target.value)} /></label>
          <p className="fehler" role="alert">{fehler}</p>
          <button className="btn btn-cta w-full" disabled={!!arbeitet}>{arbeitet ?? 'Weiter'}</button>
        </form>
      ) : (
        <form onSubmit={schritt2} className="space-y-5">
          <label>Code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} className="code" /></label>
          <p className="fehler" role="alert">{fehler}</p>
          <button className="btn btn-cta w-full" disabled={!!arbeitet}>{arbeitet ?? 'Anmelden'}</button>
        </form>
      )}
      <p className="mt-10 text-sm text-text-muted">
        Passphrase vergessen? Ein Zurücksetzen per E-Mail gibt es bewusst nicht – sonst wären die Daten unlesbar. Der Weg zurück führt über das Notfallblatt; bitte ICP kontaktieren.
      </p>
    </SchmalerRahmen>
  )
}
