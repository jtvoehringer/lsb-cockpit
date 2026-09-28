'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SchmalerRahmen } from '@/components/Rahmen'
import { FalschePassphrase } from '@/lib/crypto/kern'
import { abmelden, protokolliere, sicherheitsstufe, tresorOeffnen } from '@/lib/konto'
import { useTresor } from '@/lib/tresor'

/** Nach automatischer Sperre oder neu geladener Seite: Sitzung besteht noch, die Schlüssel aber nicht. */
export default function Entsperren() {
  const router = useRouter()
  const tresor = useTresor()
  const [passphrase, setPassphrase] = useState('')
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    void sicherheitsstufe().then(({ aal2 }) => { if (!aal2) router.replace('/anmelden') })
  }, [router])

  async function entsperren(e: React.FormEvent) {
    e.preventDefault()
    setFehler(''); setArbeitet(true)
    try {
      tresor.oeffnen(await tresorOeffnen(passphrase))
      setPassphrase('')
      await protokolliere('entsperrt')
      router.replace('/')
    } catch (err) {
      setFehler(err instanceof FalschePassphrase ? 'Passphrase stimmt nicht.' : (err as Error).message)
      if (err instanceof FalschePassphrase) await protokolliere('entsperren', undefined, 'fehlgeschlagen')
    } finally { setArbeitet(false) }
  }

  return (
    <SchmalerRahmen titel="Gesperrt" untertitel="Zum Weiterarbeiten die Passphrase eingeben.">
      <form onSubmit={entsperren} className="space-y-5">
        <label>Passphrase<input type="password" autoComplete="current-password" required autoFocus value={passphrase} onChange={(e) => setPassphrase(e.target.value)} /></label>
        <p className="fehler" role="alert">{fehler}</p>
        <button className="btn btn-cta w-full" disabled={arbeitet}>{arbeitet ? 'Schlüssel wird abgeleitet …' : 'Entsperren'}</button>
      </form>
      <button className="btn btn-ghost mt-6 w-full" onClick={async () => { await abmelden(); router.replace('/anmelden') }}>Abmelden</button>
    </SchmalerRahmen>
  )
}
