'use client'
// Geräte (Passkeys) verwalten: dieses Gerät oder ein Handy per QR-Code hinzufügen, Geräte entfernen.
// Ein neues Gerät bekommt eine Kopie des Master-Schlüssels – vorher wird der Zugriff bestätigt (Passkey, Passphrase oder Notfallblatt).
import { useEffect, useState } from 'react'
import { FalschePassphrase } from '@/lib/crypto/kern'
import { hatPassphrase, ladeSchluesselbund, masterFuerNeuesGeraet, passkeyEinrichten, passkeyEntfernen, type Nachweis, type PasskeyEintrag } from '@/lib/konto'
import { geraetVorschlag, PasskeyAbgebrochen, passkeyMoeglich, type PasskeyZiel } from '@/lib/passkey'
import { passkeyName } from './Bestaetigung'

type Props = { passkeys: PasskeyEintrag[] | null; laden: () => Promise<void>; zeit: (iso: string) => string }
type Formular = { ziel: PasskeyZiel; name: string; nachweis: Nachweis['art']; wert: string }

export function Geraete({ passkeys, laden, zeit }: Props) {
  const [moeglich, setMoeglich] = useState<boolean | null>(null)
  const [mitPassphrase, setMitPassphrase] = useState(false)
  const [f, setF] = useState<Formular | null>(null)
  const [arbeitet, setArbeitet] = useState('')
  const [fehler, setFehler] = useState('')
  const [erfolg, setErfolg] = useState('')

  useEffect(() => {
    void passkeyMoeglich().then(setMoeglich)
    void ladeSchluesselbund().then((b) => setMitPassphrase(hatPassphrase(b)))
  }, [])

  const neu = (ziel: PasskeyZiel) => {
    setFehler(''); setErfolg('')
    setF({ ziel, name: ziel === 'handy' ? 'iPhone' : geraetVorschlag(), nachweis: passkeys?.length ? 'passkey' : mitPassphrase ? 'passphrase' : 'notfall', wert: '' })
  }

  async function einrichten(e: React.FormEvent) {
    e.preventDefault()
    if (!f) return
    setFehler(''); setArbeitet(f.nachweis === 'passkey' ? `Zuerst mit einem eingerichteten Gerät bestätigen …` : 'Wird geprüft …')
    try {
      const nachweis: Nachweis = f.nachweis === 'passkey' ? { art: 'passkey' } : { art: f.nachweis, wert: f.wert }
      const master = await masterFuerNeuesGeraet(nachweis)
      setArbeitet(f.ziel === 'handy' ? 'Jetzt den QR-Code mit dem Handy scannen und dort bestätigen …' : `Jetzt mit ${passkeyName()} bestätigen …`)
      await passkeyEinrichten(master, f.name, f.ziel)
      setErfolg(`„${f.name}“ ist eingerichtet.`); setF(null); await laden()
    } catch (x) {
      setFehler(x instanceof FalschePassphrase ? 'Passphrase stimmt nicht.' : x instanceof PasskeyAbgebrochen ? 'Abgebrochen – es wurde nichts eingerichtet.' : (x as Error).message)
    } finally { setArbeitet('') }
  }

  const nachweise: [Nachweis['art'], string][] = [
    ...(passkeys?.length ? [['passkey', 'Eingerichtetes Gerät (Windows Hello / Face ID)'] as [Nachweis['art'], string]] : []),
    ...(mitPassphrase ? [['passphrase', 'Passphrase'] as [Nachweis['art'], string]] : []),
    ['notfall', 'Notfallblatt'],
  ]

  return (
    <div className="karte space-y-3">
      <h2 className="font-heading text-heading">Geräte (Windows Hello / Face ID)</h2>
      <p className="text-sm text-text-muted">Auf eingerichteten Geräten entsperrst du mit Fingerabdruck, Gesicht oder Geräte-PIN. Jedes Gerät hat einen eigenen Schlüssel, der es nie verlässt. Das Notfallblatt bleibt immer gültig.</p>
      {passkeys && passkeys.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {passkeys.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><b>{p.bezeichnung}</b> <span className="text-text-muted">· eingerichtet {zeit(p.erstellt_am)}</span></span>
              <button className="btn btn-ghost" onClick={() => {
                const letztes = passkeys.length === 1 && !mitPassphrase
                if (confirm(`„${p.bezeichnung}“ entfernen?${letztes ? ' Es ist das letzte Gerät – danach geht Entsperren nur noch mit dem Notfallblatt.' : ''}`)) void passkeyEntfernen(p).then(laden).catch((e) => setFehler(e.message))
              }}>Entfernen</button>
            </li>
          ))}
        </ul>
      )}
      {erfolg && <p className="hinweis text-sm">{erfolg}</p>}
      {fehler && <p className="fehler" role="alert">{fehler}</p>}
      {moeglich === false && <p className="hinweis text-sm">Dieser Browser unterstützt keine Passkeys.</p>}

      {moeglich && !f && (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => neu('geraet')}>Dieses Gerät einrichten</button>
          <button className="btn btn-ghost" onClick={() => neu('handy')}>Handy per QR-Code hinzufügen</button>
        </div>
      )}

      {f && (
        <form onSubmit={einrichten} className="space-y-4 border-t border-border pt-4">
          <p className="text-sm">{f.ziel === 'handy'
            ? 'Nach dem Bestätigen zeigt dieser Bildschirm einen QR-Code. Mit der Kamera des Handys scannen und dort mit Face ID bestätigen – danach entsperrt das Handy selbst.'
            : `Dieses Gerät bekommt einen eigenen Schlüssel; entsperrt wird dann mit ${passkeyName()}.`}</p>
          <label>Bezeichnung<input required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <fieldset className="space-y-1">
            <legend className="text-[13px] font-medium text-text-muted">Bestätigen mit</legend>
            {nachweise.map(([art, text]) => (
              <label key={art} className="flex items-center gap-2 text-sm font-normal text-text">
                <input type="radio" name="nachweis" checked={f.nachweis === art} onChange={() => setF({ ...f, nachweis: art, wert: '' })} /> {text}
              </label>
            ))}
          </fieldset>
          {f.nachweis === 'passphrase' && <label>Passphrase<input type="password" required autoComplete="current-password" value={f.wert} onChange={(e) => setF({ ...f, wert: e.target.value })} /></label>}
          {f.nachweis === 'notfall' && <label>Wiederherstellungscode vom Notfallblatt<input required autoComplete="off" spellCheck={false} className="code" value={f.wert} onChange={(e) => setF({ ...f, wert: e.target.value })} /></label>}
          {f.nachweis === 'passkey' && <p className="text-xs text-text-subtle">Ist auf diesem Gerät noch nichts eingerichtet, im Fenster „anderes Gerät“ wählen und mit dem Handy bestätigen.</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-cta" disabled={!!arbeitet}>{arbeitet || 'Einrichten'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setF(null); setFehler('') }}>Abbrechen</button>
          </div>
        </form>
      )}
    </div>
  )
}
