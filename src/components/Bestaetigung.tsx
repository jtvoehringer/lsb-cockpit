'use client'
// Bestätigung mit Passkey (Windows Hello / Face ID), Passphrase (falls eingerichtet) oder Notfallblatt –
// für Entsperren, Register und Honorarnoten.
import { useEffect, useState } from 'react'
import { FalschePassphrase, FalscherNotfallcode, type Tresorinhalt } from '@/lib/crypto/kern'
import { hatPassphrase, ladePasskeys, ladeSchluesselbund, protokolliere, tresorOeffnen, tresorOeffnenMitNotfallcode, tresorOeffnenMitPasskey, type PasskeyEintrag } from '@/lib/konto'
import { PasskeyAbgebrochen, passkeyMoeglich } from '@/lib/passkey'

export const passkeyName = () => (typeof navigator !== 'undefined' && /iPhone|iPad|Mac OS/.test(navigator.userAgent) ? 'Face ID' : 'Windows Hello')

type Mittel = 'passkey' | 'passphrase' | 'notfall'
type Props = {
  /** Wird mit den frisch entpackten Schlüsseln aufgerufen – gleichzeitig der Nachweis, dass die Bestätigung stimmt. */
  weiter: (t: Tresorinhalt, mittel: Mittel) => Promise<void>
  knopf: string
  ereignis: string
  autoFocus?: boolean
}

export function Bestaetigung({ weiter, knopf, ereignis, autoFocus }: Props) {
  const [lage, setLage] = useState<{ passkeys: PasskeyEintrag[]; passphrase: boolean } | null>(null)
  const [mittel, setMittel] = useState<Mittel>('passkey')
  const [eingabe, setEingabe] = useState('')
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    void Promise.all([ladePasskeys().catch(() => []), ladeSchluesselbund(), passkeyMoeglich()]).then(([p, bund, moeglich]) => {
      const passkeys = moeglich ? p : []
      setLage({ passkeys, passphrase: hatPassphrase(bund) })
      setMittel(passkeys.length ? 'passkey' : hatPassphrase(bund) ? 'passphrase' : 'notfall')
    })
  }, [])

  async function mitPasskey() {
    setFehler(''); setArbeitet(true)
    try { await weiter(await tresorOeffnenMitPasskey(lage!.passkeys), 'passkey') }
    catch (e) {
      if (!(e instanceof PasskeyAbgebrochen)) await protokolliere(ereignis, 'passkey', 'fehlgeschlagen')
      setFehler((e as Error).message)
    } finally { setArbeitet(false) }
  }

  async function absenden(e: React.FormEvent) {
    e.preventDefault(); setFehler(''); setArbeitet(true)
    try {
      const t = mittel === 'passphrase' ? await tresorOeffnen(eingabe) : await tresorOeffnenMitNotfallcode(eingabe)
      setEingabe(''); await weiter(t, mittel)
    } catch (err) {
      const falsch = err instanceof FalschePassphrase || err instanceof FalscherNotfallcode
      setFehler(err instanceof FalschePassphrase ? 'Passphrase stimmt nicht.' : (err as Error).message)
      if (falsch) await protokolliere(ereignis, mittel, 'fehlgeschlagen')
    } finally { setArbeitet(false) }
  }

  if (!lage) return <p className="text-text-muted">Einen Moment …</p>
  const wechsel = (m: Mittel, text: string) => (
    <button key={m} type="button" className="text-sm text-text-muted underline" onClick={() => { setMittel(m); setEingabe(''); setFehler('') }}>{text}</button>
  )
  const alternativen = [
    mittel !== 'passkey' && lage.passkeys.length > 0 && wechsel('passkey', `Mit ${passkeyName()}`),
    mittel !== 'passphrase' && lage.passphrase && wechsel('passphrase', 'Mit Passphrase'),
    mittel !== 'notfall' && wechsel('notfall', 'Mit Notfallblatt'),
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      {mittel === 'passkey' ? (
        <>
          <button type="button" className="btn btn-cta w-full" disabled={arbeitet} onClick={() => void mitPasskey()} autoFocus={autoFocus}>
            {arbeitet ? 'Warte auf Bestätigung …' : `${knopf} mit ${passkeyName()}`}
          </button>
          <p className="text-xs text-text-subtle">Anderes Gerät (z. B. Handy)? Im Fenster „anderes Gerät“ bzw. QR-Code wählen.</p>
          <p className="fehler" role="alert">{fehler}</p>
        </>
      ) : (
        <form onSubmit={absenden} className="space-y-4">
          {mittel === 'passphrase'
            ? <label>Passphrase<input type="password" autoComplete="current-password" required autoFocus={autoFocus} value={eingabe} onChange={(e) => setEingabe(e.target.value)} /></label>
            : <label>Wiederherstellungscode vom Notfallblatt<input autoComplete="off" spellCheck={false} required autoFocus={autoFocus} value={eingabe} onChange={(e) => setEingabe(e.target.value)} className="code" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-X" /></label>}
          <p className="fehler" role="alert">{fehler}</p>
          <button className="btn btn-cta w-full" disabled={arbeitet}>{arbeitet ? 'Wird geprüft …' : knopf}</button>
        </form>
      )}
      {alternativen.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-1">{alternativen}</div>}
    </div>
  )
}
