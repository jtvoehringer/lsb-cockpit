'use client'
// Bestätigung mit Passkey (Windows Hello / Face ID) oder Passphrase – für Entsperren, Register und Honorarnoten.
import { useEffect, useState } from 'react'
import { FalschePassphrase, type Tresorinhalt } from '@/lib/crypto/kern'
import { ladePasskeys, protokolliere, tresorOeffnen, tresorOeffnenMitPasskey, type PasskeyEintrag } from '@/lib/konto'
import { PasskeyAbgebrochen, passkeyMoeglich } from '@/lib/passkey'

export const passkeyName = () => (typeof navigator !== 'undefined' && /iPhone|iPad|Mac OS/.test(navigator.userAgent) ? 'Face ID' : 'Windows Hello')

type Props = {
  /** Wird mit den frisch entpackten Schlüsseln aufgerufen – gleichzeitig der Nachweis, dass die Bestätigung stimmt. */
  weiter: (t: Tresorinhalt, mittel: 'passkey' | 'passphrase') => Promise<void>
  knopf: string
  ereignis: string
  autoFocus?: boolean
}

export function Bestaetigung({ weiter, knopf, ereignis, autoFocus }: Props) {
  const [passkeys, setPasskeys] = useState<PasskeyEintrag[] | null>(null)
  const [mitPassphrase, setMitPassphrase] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    void Promise.all([ladePasskeys().catch(() => []), passkeyMoeglich()]).then(([p, moeglich]) => setPasskeys(moeglich ? p : []))
  }, [])

  async function mitPasskey() {
    setFehler(''); setArbeitet(true)
    try { await weiter(await tresorOeffnenMitPasskey(passkeys!), 'passkey') }
    catch (e) {
      if (!(e instanceof PasskeyAbgebrochen)) await protokolliere(ereignis, 'passkey', 'fehlgeschlagen')
      setFehler((e as Error).message)
    } finally { setArbeitet(false) }
  }

  async function absenden(e: React.FormEvent) {
    e.preventDefault(); setFehler(''); setArbeitet(true)
    try { const t = await tresorOeffnen(passphrase); setPassphrase(''); await weiter(t, 'passphrase') }
    catch (err) {
      setFehler(err instanceof FalschePassphrase ? 'Passphrase stimmt nicht.' : (err as Error).message)
      if (err instanceof FalschePassphrase) await protokolliere(ereignis, undefined, 'fehlgeschlagen')
    } finally { setArbeitet(false) }
  }

  if (passkeys === null) return <p className="text-text-muted">Einen Moment …</p>
  const passkeyZuerst = passkeys.length > 0 && !mitPassphrase

  return (
    <div className="space-y-4">
      {passkeyZuerst ? (
        <>
          <button type="button" className="btn btn-cta w-full" disabled={arbeitet} onClick={() => void mitPasskey()} autoFocus={autoFocus}>
            {arbeitet ? 'Warte auf Bestätigung …' : `${knopf} mit ${passkeyName()}`}
          </button>
          <p className="fehler" role="alert">{fehler}</p>
          <button type="button" className="text-sm text-text-muted underline" onClick={() => { setMitPassphrase(true); setFehler('') }}>Stattdessen Passphrase verwenden</button>
        </>
      ) : (
        <form onSubmit={absenden} className="space-y-4">
          <label>Passphrase<input type="password" autoComplete="current-password" required autoFocus={autoFocus} value={passphrase} onChange={(e) => setPassphrase(e.target.value)} /></label>
          <p className="fehler" role="alert">{fehler}</p>
          <button className="btn btn-cta w-full" disabled={arbeitet}>{arbeitet ? 'Schlüssel wird abgeleitet …' : knopf}</button>
          {passkeys.length > 0 && <button type="button" className="text-sm text-text-muted underline" onClick={() => { setMitPassphrase(false); setFehler('') }}>Zurück zu {passkeyName()}</button>}
        </form>
      )}
    </div>
  )
}
