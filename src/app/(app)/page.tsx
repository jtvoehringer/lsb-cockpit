'use client'
import { useState } from 'react'
import { aad, entschluessele, verschluessele } from '@/lib/crypto/kern'
import { SPERRE_NACH_MIN, useTresor } from '@/lib/tresor'

export default function Uebersicht() {
  const tresor = useTresor()
  const [probe, setProbe] = useState<string | null>(null)

  async function selbsttest() {
    const z = aad('selbsttest', crypto.randomUUID(), 'inhalt')
    const c = await verschluessele(tresor.schluessel('zone_b'), 'Tresor funktioniert ✓', z)
    setProbe(await entschluessele(tresor.schluessel('zone_b'), c, z))
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="overline">Übersicht</p>
        <h1 className="mt-2 font-heading text-heading">Willkommen</h1>
      </div>
      <div className="karte space-y-3">
        <p><b>Der Tresor ist offen.</b> Die Schlüssel liegen nur im Arbeitsspeicher dieses Browser-Tabs. Nach {SPERRE_NACH_MIN} Minuten ohne Eingabe, beim Sperren oder Schließen des Tabs sind sie wieder weg.</p>
        <p className="text-text-muted">Protokolle diktieren und abschließen unter „Protokolle“, Auswertung für den Befähigungsnachweis unter „Nachweis“. Namen zu den Chiffren stehen im Register – es öffnet sich nur nach erneuter Passphrase-Eingabe.</p>
        <button className="btn btn-ghost" onClick={selbsttest}>Selbsttest Verschlüsselung</button>
        {probe && <p className="text-sm">{probe}</p>}
      </div>
    </div>
  )
}
