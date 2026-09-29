'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { abmelden, ladeAudit, protokolliere } from '@/lib/konto'
import { useTresor } from '@/lib/tresor'

type AuditZeile = { zeitpunkt: string; ereignis: string; objekt: string | null; ergebnis: string | null }

const EREIGNIS: Record<string, string> = {
  einrichtung: 'Konto eingerichtet', anmeldung: 'Anmeldung', abmeldung: 'Abmeldung', entsperrt: 'Entsperrt',
  gesperrt: 'Gesperrt', entsperren: 'Entsperren', abmeldung_ueberall: 'Auf allen Geräten abgemeldet',
  akte_angelegt: 'Akte angelegt', protokoll_abgeschlossen: 'Protokoll abgeschlossen', protokoll_korrigiert: 'Protokoll korrigiert',
  register_geoeffnet: 'Register geöffnet', register_geaendert: 'Register geändert', register_gesperrt: 'Register gesperrt',
  uebernahme_prototyp: 'Übernahme aus Prototyp',
}

export default function Schutz() {
  const router = useRouter()
  const tresor = useTresor()
  const [audit, setAudit] = useState<AuditZeile[] | null>(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => { ladeAudit(30).then(setAudit).catch((e) => setFehler(e.message)) }, [])

  const zeit = (iso: string) => new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vienna' }).format(new Date(iso))

  return (
    <div className="space-y-6">
      <div>
        <p className="overline">Schutz &amp; Audit</p>
        <h1 className="mt-2 font-heading text-heading">Schutz &amp; Audit</h1>
      </div>

      <div className="karte grid gap-2 text-sm sm:grid-cols-[180px_1fr]">
        <b>Version</b><span className="tabular-nums">Commit {process.env.NEXT_PUBLIC_COMMIT} · ausgeliefert {zeit(process.env.NEXT_PUBLIC_BUILD_ZEIT!)}</span>
        <b>Verschlüsselung</b><span>AES-256-GCM im Browser; Schlüssel aus der Passphrase (PBKDF2, 600.000 Iterationen). Server sehen nur Chiffretext.</span>
        <b>Anmeldung</b><span>Passphrase und Authenticator-App (zwei Faktoren); Datenzugriff nur mit beiden.</span>
      </div>

      <div className="karte">
        <h2 className="font-heading text-heading">Letzte Ereignisse</h2>
        {fehler && <p className="fehler">{fehler}</p>}
        {audit && (audit.length === 0 ? <p className="mt-3 text-text-muted">Noch keine Einträge.</p> : (
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left text-text-subtle"><th className="py-2 font-medium">Zeitpunkt</th><th className="font-medium">Ereignis</th><th className="font-medium">Ergebnis</th></tr></thead>
            <tbody>{audit.map((a, i) => (
              <tr key={i} className="border-t border-border"><td className="py-2 tabular-nums">{zeit(a.zeitpunkt)}</td><td>{EREIGNIS[a.ereignis] ?? a.ereignis}</td><td>{a.ergebnis}</td></tr>
            ))}</tbody>
          </table>
        ))}
      </div>

      <div className="karte space-y-3">
        <h2 className="font-heading text-heading">Sitzungen</h2>
        <p className="text-sm text-text-muted">Wenn ein Gerät verloren ging oder ein fremder Zugriff vermutet wird.</p>
        <button className="btn btn-ghost" onClick={async () => { await protokolliere('abmeldung_ueberall'); tresor.sperren(); await abmelden(true); router.replace('/anmelden') }}>Auf allen Geräten abmelden</button>
      </div>
    </div>
  )
}
