'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Bestaetigung } from '@/components/Bestaetigung'
import { SchmalerRahmen } from '@/components/Rahmen'
import { abmelden, protokolliere, sicherheitsstufe } from '@/lib/konto'
import { useTresor } from '@/lib/tresor'

/** Nach automatischer Sperre oder neu geladener Seite: Sitzung besteht noch, die Schlüssel aber nicht. */
export default function Entsperren() {
  const router = useRouter()
  const tresor = useTresor()

  useEffect(() => {
    void sicherheitsstufe().then(({ aal2 }) => { if (!aal2) router.replace('/anmelden') })
  }, [router])

  return (
    <SchmalerRahmen titel="Gesperrt" untertitel="Zum Weiterarbeiten entsperren.">
      <Bestaetigung knopf="Entsperren" ereignis="entsperren" autoFocus weiter={async (t, mittel) => {
        tresor.oeffnen(t)
        await protokolliere('entsperrt', { passkey: 'Passkey', passphrase: 'Passphrase', notfall: 'Notfallblatt' }[mittel])
        router.replace('/')
      }} />
      <button className="btn btn-ghost mt-6 w-full" onClick={async () => { await abmelden(); router.replace('/anmelden') }}>Abmelden</button>
    </SchmalerRahmen>
  )
}
