'use client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { FalschePassphrase } from '@/lib/crypto/kern'
import { abmelden, aktiveFreigabe, freigabeBeenden, freigeben, ladeAudit, ladeFreigaben, ladePasskeys, passkeyEinrichten, passkeyEntfernen, protokolliere, type Freigabe, type PasskeyEintrag } from '@/lib/konto'
import { geraetVorschlag, PasskeyAbgebrochen, passkeyMoeglich } from '@/lib/passkey'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useTresor } from '@/lib/tresor'

type AuditZeile = { zeitpunkt: string; ereignis: string; objekt: string | null; ergebnis: string | null; user_id: string }

const EREIGNIS: Record<string, string> = {
  einrichtung: 'Konto eingerichtet', anmeldung: 'Anmeldung', abmeldung: 'Abmeldung', entsperrt: 'Entsperrt',
  gesperrt: 'Gesperrt', entsperren: 'Entsperren', abmeldung_ueberall: 'Auf allen Geräten abgemeldet',
  akte_angelegt: 'Akte angelegt', protokoll_abgeschlossen: 'Protokoll abgeschlossen', protokoll_korrigiert: 'Protokoll korrigiert',
  register_geoeffnet: 'Register geöffnet', register_geaendert: 'Register geändert', register_gesperrt: 'Register gesperrt',
  uebernahme_prototyp: 'Übernahme aus Prototyp', buchung_angelegt: 'Buchung angelegt', buchung_geaendert: 'Buchung geändert',
  buchung_geloescht: 'Buchung gelöscht', honorarnote_ausgestellt: 'Honorarnote ausgestellt', honorarnote_bezahlt: 'Honorarnote bezahlt',
  honorarnote_storniert: 'Honorarnote storniert', einstellungen_geaendert: 'Einstellungen geändert',
  passkey_eingerichtet: 'Gerät (Passkey) eingerichtet', passkey_entfernt: 'Gerät (Passkey) entfernt',
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
  const [passkeyOk, setPasskeyOk] = useState<boolean | null>(null)
  const [einrichten, setEinrichten] = useState<null | { name: string; passphrase: string }>(null)
  const [arbeitet, setArbeitet] = useState(false)

  const laden = useCallback(async () => {
    const [a, f, u, p] = await Promise.all([ladeAudit(40), ladeFreigaben(), supabaseBrowser().auth.getUser(), ladePasskeys()])
    setAudit(a as AuditZeile[]); setFreigaben(f); setIch(u.data.user?.id ?? ''); setPasskeys(p)
  }, [])
  useEffect(() => { laden().catch((e) => setFehler(e.message)); void passkeyMoeglich().then(setPasskeyOk) }, [laden])

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
        <b>Verschlüsselung</b><span>AES-256-GCM im Browser; Schlüssel aus der Passphrase (PBKDF2, 600.000 Iterationen). Server sehen nur Chiffretext.</span>
        <b>Anmeldung</b><span>Passphrase und Authenticator-App (zwei Faktoren); Datenzugriff nur mit beiden. Entsperren auch per Passkey des Geräts.</span>
      </div>

      <div className="karte space-y-3">
        <h2 className="font-heading text-heading">Entsperren mit Windows Hello / Face ID</h2>
        <p className="text-sm text-text-muted">Statt der Passphrase genügt auf eingerichteten Geräten Fingerabdruck, Gesichtserkennung oder PIN des Geräts (Passkey). Jedes Gerät bekommt einen eigenen Schlüssel; er verlässt das Gerät nie. Die Passphrase und das Notfallblatt bleiben gültig.</p>
        {passkeys && passkeys.length > 0 && (
          <ul className="divide-y divide-border text-sm">
            {passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><b>{p.bezeichnung}</b> <span className="text-text-muted">· eingerichtet {zeit(p.erstellt_am)}</span></span>
                <button className="btn btn-ghost" onClick={() => { if (confirm(`„${p.bezeichnung}“ entfernen? Auf diesem Gerät ist dann wieder die Passphrase nötig.`)) void passkeyEntfernen(p).then(laden).catch((e) => setFehler(e.message)) }}>Entfernen</button>
              </li>
            ))}
          </ul>
        )}
        {passkeyOk === false && <p className="hinweis text-sm">Dieser Browser unterstützt das Entsperren per Passkey nicht.</p>}
        {passkeyOk && (einrichten ? (
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={async (e) => {
            e.preventDefault(); setFehler(''); setArbeitet(true)
            try { await passkeyEinrichten(einrichten.passphrase, einrichten.name); setEinrichten(null); await laden() }
            catch (x) { setFehler(x instanceof FalschePassphrase ? 'Passphrase stimmt nicht.' : x instanceof PasskeyAbgebrochen ? 'Abgebrochen – es wurde nichts eingerichtet.' : (x as Error).message) }
            finally { setArbeitet(false) }
          }}>
            <label>Bezeichnung<input required maxLength={60} value={einrichten.name} onChange={(e) => setEinrichten({ ...einrichten, name: e.target.value })} /></label>
            <label>Passphrase zur Bestätigung<input type="password" required autoComplete="current-password" value={einrichten.passphrase} onChange={(e) => setEinrichten({ ...einrichten, passphrase: e.target.value })} /></label>
            <div className="flex gap-2"><button className="btn btn-cta" disabled={arbeitet}>{arbeitet ? 'Bitte am Gerät bestätigen …' : 'Einrichten'}</button><button type="button" className="btn btn-ghost" onClick={() => setEinrichten(null)}>Abbrechen</button></div>
          </form>
        ) : (
          <button className="btn btn-ghost" onClick={() => setEinrichten({ name: geraetVorschlag(), passphrase: '' })}>Dieses Gerät einrichten</button>
        ))}
      </div>

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
