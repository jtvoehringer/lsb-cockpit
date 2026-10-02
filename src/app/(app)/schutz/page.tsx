'use client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Geraete } from '@/components/Geraete'
import { Sicherung } from '@/components/Sicherung'
import { abmelden, aktiveFreigabe, freigabeBeenden, freigeben, ladeAudit, ladeFreigaben, ladePasskeys, protokolliere, type Freigabe, type PasskeyEintrag } from '@/lib/konto'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useTresor } from '@/lib/tresor'

type AuditZeile = { zeitpunkt: string; ereignis: string; objekt: string | null; ergebnis: string | null; user_id: string }

const EREIGNIS: Record<string, string> = {
  einrichtung: 'Konto eingerichtet', anmeldung: 'Anmeldung', abmeldung: 'Abmeldung', entsperrt: 'Entsperrt',
  gesperrt: 'Gesperrt', entsperren: 'Entsperren', abmeldung_ueberall: 'Auf allen Geräten abgemeldet',
  akte_angelegt: 'Akte angelegt', chiffre_geaendert: 'Chiffre an das Jahr angepasst', protokoll_abgeschlossen: 'Protokoll abgeschlossen', protokoll_korrigiert: 'Protokoll korrigiert',
  register_geoeffnet: 'Register geöffnet', register_geaendert: 'Register geändert', register_gesperrt: 'Register gesperrt',
  uebernahme_prototyp: 'Übernahme aus Prototyp', buchung_angelegt: 'Buchung angelegt', buchung_geaendert: 'Buchung geändert',
  buchung_geloescht: 'Buchung gelöscht', honorarnote_ausgestellt: 'Honorarnote ausgestellt', honorarnote_bezahlt: 'Honorarnote bezahlt',
  honorarnote_storniert: 'Honorarnote storniert', einstellungen_geaendert: 'Einstellungen geändert',
  notfallcode_verwendet: 'Mit Notfallblatt entsperrt', stammdaten_geaendert: 'Stammdaten geändert', pseudonym_bestaetigt: 'Namens-Prüfung bestätigt', akte_abgeschlossen: 'Akte abgeschlossen', auskunft_erstellt: 'Auskunft erstellt', bestaetigung_erstellt: 'Teilnahmebestätigung erstellt', export_erstellt: 'Gesamt-Export erstellt', export_erstellen: 'Export bestätigen', akte_wieder_geoeffnet: 'Akte wieder geöffnet', akte_geloescht: 'Akte gelöscht', akte_loeschen: 'Löschung bestätigen', fristen_geaendert: 'Aufbewahrungsfristen geändert', dokument_hochgeladen: 'Dokument hochgeladen', dokument_geloescht: 'Dokument gelöscht', passkey_eingerichtet: 'Gerät (Passkey) eingerichtet', passkey_entfernt: 'Gerät (Passkey) entfernt',
  support_freigegeben: 'Support freigegeben', support_freigabe_beendet: 'Support-Freigabe beendet', support_zugriff: 'Zugriff durch Support',
}

export default function Schutz() {
  const router = useRouter()
  const tresor = useTresor()
  const [audit, setAudit] = useState<AuditZeile[] | null>(null)
  const [freigaben, setFreigaben] = useState<Freigabe[]>([])
  const [ich, setIch] = useState('')
  const [fehler, setFehler] = useState('')

  const [passkeys, setPasskeys] = useState<PasskeyEintrag[] | null>(null)

  const laden = useCallback(async () => {
    const [a, f, u, p] = await Promise.all([ladeAudit(40), ladeFreigaben(), supabaseBrowser().auth.getUser(), ladePasskeys()])
    setAudit(a as AuditZeile[]); setFreigaben(f); setIch(u.data.user?.id ?? ''); setPasskeys(p)
  }, [])
  useEffect(() => { laden().catch((e) => setFehler(e.message)) }, [laden])

  const zeit = (iso: string) => new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vienna' }).format(new Date(iso))
  const aktiv = aktiveFreigabe(freigaben)

  return (
    <div className="space-y-6">
      <div>
        <p className="overline">Schutz &amp; Audit</p>
        <h1 className="mt-2 font-heading text-heading">Schutz &amp; Audit</h1>
      </div>
      {fehler && <p className="fehler">{fehler}</p>}

      <div className="karte grid gap-2 text-sm sm:grid-cols-[180px_1fr]">
        <b>Version</b><span className="tabular-nums">Commit {process.env.NEXT_PUBLIC_COMMIT} · ausgeliefert {zeit(process.env.NEXT_PUBLIC_BUILD_ZEIT!)}</span>
        <b>Verschlüsselung</b><span>AES-256-GCM im Browser. Der Hauptschlüssel ist je Gerät mit dessen Passkey gesichert (WebAuthn-PRF), dazu das Notfallblatt (und ggf. die Passphrase, PBKDF2 600.000). Server sehen nur Chiffretext.</span>
        <b>Anmeldung</b><span>Code per E-Mail und Code aus der Authenticator-App; Datenzugriff nur mit beiden. Lesbar werden die Daten erst mit dem Schlüssel des Geräts (Windows Hello / Face ID), dem Notfallblatt oder der Passphrase.</span>
      </div>

      <Geraete passkeys={passkeys} laden={laden} zeit={zeit} />

      <Sicherung />

      <div className="karte space-y-3">
        <h2 className="font-heading text-heading">Support-Freigabe (ICP)</h2>
        <p className="text-sm text-text-muted">Ohne deine Freigabe hat niemand Zugang – auch ICP nicht. Mit einer befristeten Freigabe sieht der Support Einstellungen, Chiffren, Termine und dieses Protokoll, aber <b>keine Namen, keine Protokollinhalte, kein Register und keine Finanzen</b> (dafür fehlt ihm der Schlüssel). Jeder Zugriff erscheint unten.</p>
        {aktiv ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="hinweis">Freigegeben bis {zeit(aktiv.gueltig_bis)}</span>
            <button className="btn btn-cta" onClick={() => void freigabeBeenden(aktiv.id).then(laden).catch((e) => setFehler(e.message))}>Freigabe jetzt beenden</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[[1, '1 Stunde'], [24, '24 Stunden'], [168, '7 Tage']].map(([h, t]) => (
              <button key={h} className="btn btn-ghost" onClick={() => { if (confirm(`Support ${t} lang freigeben? Du kannst die Freigabe jederzeit beenden.`)) void freigeben(h as number).then(laden).catch((e) => setFehler(e.message)) }}>{t} freigeben</button>
            ))}
          </div>
        )}
      </div>

      <div className="karte">
        <h2 className="font-heading text-heading">Letzte Ereignisse</h2>
        {audit && (audit.length === 0 ? <p className="mt-3 text-text-muted">Noch keine Einträge.</p> : (
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left text-text-subtle"><th className="py-2 font-medium">Zeitpunkt</th><th className="font-medium">Ereignis</th><th className="font-medium">Wer</th><th className="font-medium">Ergebnis</th></tr></thead>
            <tbody>{audit.map((a, i) => (
              <tr key={i} className={`border-t border-border ${a.user_id !== ich ? 'bg-sand/50' : ''}`}><td className="py-2 tabular-nums">{zeit(a.zeitpunkt)}</td><td>{EREIGNIS[a.ereignis] ?? a.ereignis}</td><td>{a.user_id === ich ? 'du' : 'Support (ICP)'}</td><td>{a.ergebnis}</td></tr>
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
