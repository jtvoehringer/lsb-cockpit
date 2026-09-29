'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { aad, entschluessele, verschluessele } from '@/lib/crypto/kern'
import { ladeAkten, type Akte } from '@/lib/protokolle/daten'
import { heuteIso } from '@/lib/stammdaten'
import { SPERRE_NACH_MIN, useTresor } from '@/lib/tresor'

export default function Uebersicht() {
  const tresor = useTresor()
  const [probe, setProbe] = useState<string | null>(null)
  const [akten, setAkten] = useState<Akte[] | null>(null)

  useEffect(() => { ladeAkten().then(setAkten).catch(() => setAkten([])) }, [])

  async function selbsttest() {
    const z = aad('selbsttest', crypto.randomUUID(), 'inhalt')
    const c = await verschluessele(tresor.schluessel('zone_b'), 'Tresor funktioniert ✓', z)
    setProbe(await entschluessele(tresor.schluessel('zone_b'), c, z))
  }

  const heute = heuteIso()
  const faellig = (akten ?? []).filter((a) => a.status === 'abgeschlossen' && a.aufbewahrung_bis && a.aufbewahrung_bis <= heute).length
  const ohneEinwilligung = (akten ?? []).filter((a) => a.status === 'offen' && !a.einwilligung_am).length

  return (
    <div className="space-y-6">
      <div>
        <p className="overline">Übersicht</p>
        <h1 className="mt-2 font-heading text-heading">Willkommen</h1>
      </div>
      {(faellig > 0 || ohneEinwilligung > 0) && (
        <div className="karte space-y-2">
          <h2 className="font-heading text-heading">Zu erledigen</h2>
          {faellig > 0 && <p><Link href="/fristen">{faellig} Akte{faellig === 1 ? ' ist' : 'n sind'} zur Löschung fällig</Link> – die Aufbewahrungsfrist ist abgelaufen.</p>}
          {ohneEinwilligung > 0 && <p><Link href="/register">Bei {ohneEinwilligung} offenen Akte{ohneEinwilligung === 1 ? '' : 'n'} fehlt die Einwilligung</Link> zur Verarbeitung der Gesundheitsdaten.</p>}
        </div>
      )}
      <div className="karte space-y-3">
        <p><b>Der Tresor ist offen.</b> Die Schlüssel liegen nur im Arbeitsspeicher dieses Browser-Tabs. Nach {SPERRE_NACH_MIN} Minuten ohne Eingabe, beim Sperren oder Schließen des Tabs sind sie wieder weg.</p>
        <p className="text-text-muted">Protokolle diktieren und abschließen unter „Protokolle“, Auswertung für den Befähigungsnachweis unter „Nachweis“. Namen zu den Chiffren stehen im Register – es öffnet sich nur nach erneuter Bestätigung.</p>
        <button className="btn btn-ghost" onClick={selbsttest}>Selbsttest Verschlüsselung</button>
        {probe && <p className="text-sm">{probe}</p>}
      </div>
    </div>
  )
}
