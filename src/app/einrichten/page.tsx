'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { passkeyName } from '@/components/Bestaetigung'
import { SchmalerRahmen } from '@/components/Rahmen'
import brand from '@/config/brand.config'
import { formatiereCode, type Tresorinhalt } from '@/lib/crypto/kern'
import { pruefePassphrase } from '@/lib/crypto/passphrase'
import {
  abmelden, anmelden, einrichtungAbschliessen, hatSchluesselbund, ladeSchluesselbund, rolle, schluesselEinrichten, schluesselEinrichtenMitPasskey,
  sicherheitsstufe, supportEinrichten, totpAnlegen, totpBestaetigen, tresorOeffnen, verifizierterTotpFaktor,
} from '@/lib/konto'
import { geraetVorschlag, PasskeyAbgebrochen, passkeyMoeglich } from '@/lib/passkey'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useTresor } from '@/lib/tresor'

// Einrichtung (einmalig): E-Mail + Einrichtungscode von ICP → Authenticator-App → Windows Hello / Face ID → Notfallblatt.
// Die Passphrase ist nur noch Ausweichweg für Geräte ohne Passkey-Unterstützung.
type Schritt = 'code' | 'totp-bestehend' | 'totp-neu' | 'schutz' | 'passphrase' | 'notfall'

export default function Einrichten() {
  const router = useRouter()
  const tresor = useTresor()
  const [schritt, setSchritt] = useState<Schritt>('code')
  const [email, setEmail] = useState('')
  const [einrichtungscode, setEinrichtungscode] = useState('')
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [verstanden, setVerstanden] = useState(false)
  const [totp, setTotp] = useState<{ faktorId: string; qrCode: string; geheimnis: string } | null>(null)
  const [faktorId, setFaktorId] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [geraet, setGeraet] = useState('')
  const [passkeyOk, setPasskeyOk] = useState<boolean | null>(null)
  const [notfallcode, setNotfallcode] = useState('')
  const [verwahrt, setVerwahrt] = useState(false)
  const [arbeitet, setArbeitet] = useState<string | null>(null)
  const [fehler, setFehler] = useState('')
  const [bereits, setBereits] = useState('')
  const schluessel = useRef<Tresorinhalt | null>(null)
  const pruefung = useMemo(() => pruefePassphrase(p1, email), [p1, email])

  // Schon per E-Mail-Code angemeldet (von /anmelden hierher geleitet)? Dann ohne Einrichtungscode weiter.
  useEffect(() => {
    setGeraet(geraetVorschlag()); void passkeyMoeglich().then(setPasskeyOk)
    void sicherheitsstufe().then(async ({ angemeldet, aal2 }) => {
      if (!angemeldet) return
      const angemeldetAls = (await supabaseBrowser().auth.getUser()).data.user?.email ?? ''
      if (aal2 && hatSchluesselbund(await ladeSchluesselbund())) { setBereits(angemeldetAls); return }
      setEmail(angemeldetAls)
      if (aal2) { await nachTotp(); return }
      const f = await verifizierterTotpFaktor()
      if (f) { setFaktorId(f); setSchritt('totp-bestehend') } else { setTotp(await totpAnlegen()); setSchritt('totp-neu') }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function laufe(text: string, f: () => Promise<void>) {
    setFehler(''); setArbeitet(text)
    try { await f() } catch (err) {
      setFehler(err instanceof PasskeyAbgebrochen ? 'Abgebrochen – bitte nochmals versuchen.' : (err as Error).message)
    } finally { setArbeitet(null) }
  }

  /** Nach erfolgreichem TOTP (AAL2): Support ist fertig, Beraterin richtet den Schutz ein. */
  async function nachTotp() {
    if ((await rolle()) === 'support') { await supportEinrichten(); router.replace('/support'); return }
    if (hatSchluesselbund(await ladeSchluesselbund())) { router.replace('/entsperren'); return }
    setSchritt('schutz')
  }

  const mitCode = (e: React.FormEvent) => { e.preventDefault(); void laufe('Wird geprüft …', async () => {
    const { faktorId } = await anmelden(email, einrichtungscode.trim())
    setEinrichtungscode('')
    if (faktorId) { setFaktorId(faktorId); setSchritt('totp-bestehend') } else { setTotp(await totpAnlegen()); setSchritt('totp-neu') }
  }) }

  const bestehendenTotpPruefen = (e: React.FormEvent) => { e.preventDefault(); void laufe('Wird geprüft …', async () => {
    await totpBestaetigen(faktorId!, totpCode); setTotpCode('')
    await nachTotp()
  }) }

  const neuenTotpBestaetigen = (e: React.FormEvent) => { e.preventDefault(); void laufe('Wird geprüft …', async () => {
    await totpBestaetigen(totp!.faktorId, totpCode); setTotpCode('')
    await nachTotp()
  }) }

  const mitPasskey = () => void laufe(`Bitte mit ${passkeyName()} bestätigen …`, async () => {
    const { wiederherstellungscode, tresor: t } = await schluesselEinrichtenMitPasskey(geraet)
    schluessel.current = t
    setNotfallcode(wiederherstellungscode); setSchritt('notfall')
  })

  const passphraseWaehlen = (e: React.FormEvent) => { e.preventDefault()
    if (!pruefung.ok) { setFehler(pruefung.hinweise.join(' ')); return }
    if (p1 !== p2) { setFehler('Die beiden Eingaben stimmen nicht überein.'); return }
    if (!verstanden) { setFehler('Bitte die Bestätigung ankreuzen.'); return }
    void laufe('Schlüssel werden erzeugt …', async () => {
      setNotfallcode(await schluesselEinrichten(email, p1))
      schluessel.current = await tresorOeffnen(p1)
      setP1(''); setP2('')
      setSchritt('notfall')
    })
  }

  const abschliessen = () => void laufe('Wird abgeschlossen …', async () => {
    if (!schluessel.current) throw new Error('Schlüssel fehlen – bitte Seite neu laden und entsperren.')
    tresor.oeffnen(schluessel.current); schluessel.current = null
    await einrichtungAbschliessen()
    setNotfallcode('')
    router.replace('/')
  })

  return (
    <SchmalerRahmen titel="Konto einrichten" untertitel={UNTERTITEL[schritt]}>
      {schritt === 'code' && bereits && (
        <div className="space-y-4">
          <p className="hinweis">Dieser Browser ist noch als <b>{bereits}</b> angemeldet – dieses Konto ist bereits eingerichtet.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-cta" onClick={() => router.replace('/entsperren')}>Weiter als {bereits}</button>
            <button type="button" className="btn btn-ghost" onClick={async () => { await abmelden(); tresor.sperren(); setBereits('') }}>Abmelden und anderes Konto einrichten</button>
          </div>
        </div>
      )}

      {schritt === 'code' && !bereits && (
        <form onSubmit={mitCode} className="space-y-5">
          <label>E-Mail-Adresse<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Einrichtungscode (von ICP)<input type="password" autoComplete="one-time-code" required value={einrichtungscode} onChange={(e) => setEinrichtungscode(e.target.value)} /></label>
          <Fehler text={fehler} />
          <button className="btn btn-cta w-full" disabled={!!arbeitet}>{arbeitet ?? 'Weiter'}</button>
        </form>
      )}

      {schritt === 'totp-bestehend' && (
        <form onSubmit={bestehendenTotpPruefen} className="space-y-5">
          <label>Code aus der Authenticator-App<input inputMode="numeric" autoComplete="one-time-code" required autoFocus value={totpCode} onChange={(e) => setTotpCode(e.target.value)} className="code" /></label>
          <Fehler text={fehler} />
          <button className="btn btn-cta w-full" disabled={!!arbeitet}>{arbeitet ?? 'Weiter'}</button>
        </form>
      )}

      {schritt === 'totp-neu' && totp && (
        <form onSubmit={neuenTotpBestaetigen} className="space-y-5">
          <p>Authenticator-App am Handy öffnen (z. B. Microsoft oder Google Authenticator), „Konto hinzufügen“ wählen und diesen QR-Code scannen:</p>
          <div className="karte flex justify-center"><img src={totp.qrCode} alt="QR-Code für die Authenticator-App" width={200} height={200} /></div>
          <details className="text-sm text-text-muted"><summary>QR-Code lässt sich nicht scannen?</summary><p className="mt-2">Schlüssel manuell eingeben: <span className="code text-base break-all">{totp.geheimnis}</span></p></details>
          <label>Sechsstelliger Code aus der App<input inputMode="numeric" autoComplete="one-time-code" required value={totpCode} onChange={(e) => setTotpCode(e.target.value)} className="code" /></label>
          <Fehler text={fehler} />
          <button className="btn btn-cta w-full" disabled={!!arbeitet}>{arbeitet ?? 'Bestätigen'}</button>
        </form>
      )}

      {schritt === 'schutz' && (
        <div className="space-y-5">
          <div className="hinweis space-y-2">
            <p><b>So funktioniert der Schutz:</b> Alle Inhalte werden auf deinem Gerät verschlüsselt. Den Schlüssel sichert {passkeyName()} – Fingerabdruck, Gesicht oder Geräte-PIN. Niemand sonst kann die Daten lesen, auch ICP nicht.</p>
            <p>Gleich danach bekommst du ein <b>Notfallblatt</b>. Es ist der einzige Weg zurück, falls alle Geräte verloren gehen – bitte ausdrucken und sicher verwahren.</p>
          </div>
          {passkeyOk === false && <p className="hinweis text-sm">Dieser Browser unterstützt keine Passkeys. Bitte die Passphrase verwenden – oder die Einrichtung in Chrome, Edge oder Safari machen.</p>}
          {passkeyOk && (
            <>
              <label>Bezeichnung dieses Geräts<input required maxLength={60} value={geraet} onChange={(e) => setGeraet(e.target.value)} /></label>
              <Fehler text={fehler} />
              <button type="button" className="btn btn-cta w-full" disabled={!!arbeitet} onClick={mitPasskey}>{arbeitet ?? `Mit ${passkeyName()} einrichten`}</button>
            </>
          )}
          <button type="button" className="text-sm text-text-muted underline" onClick={() => { setFehler(''); setSchritt('passphrase') }}>Stattdessen eine Passphrase verwenden</button>
        </div>
      )}

      {schritt === 'passphrase' && (
        <form onSubmit={passphraseWaehlen} className="space-y-5">
          <div className="hinweis space-y-2">
            <p>Alle Inhalte werden mit einem Schlüssel aus deiner Passphrase verschlüsselt. <b>Gehen Passphrase und Notfallblatt verloren, sind die Daten verloren.</b></p>
          </div>
          <label>Passphrase<input type="password" autoComplete="new-password" required value={p1} onChange={(e) => setP1(e.target.value)} /></label>
          <p className="text-sm text-text-muted">Mindestens 16 Zeichen oder 5 Wörter – z. B. fünf zufällige Wörter. Aufschreiben und sicher verwahren.</p>
          {p1 && !pruefung.ok && <ul className="list-disc pl-5 text-sm text-text-muted">{pruefung.hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}
          <label>Passphrase wiederholen<input type="password" autoComplete="new-password" required value={p2} onChange={(e) => setP2(e.target.value)} /></label>
          <label className="flex items-start gap-3 text-sm font-normal text-text"><input type="checkbox" checked={verstanden} onChange={(e) => setVerstanden(e.target.checked)} className="mt-0.5" /> Ich habe verstanden: Ohne Passphrase und ohne Notfallblatt sind die Daten nicht wiederherstellbar.</label>
          <Fehler text={fehler} />
          <button className="btn btn-cta w-full" disabled={!!arbeitet}>{arbeitet ?? 'Weiter'}</button>
          {passkeyOk && <button type="button" className="text-sm text-text-muted underline" onClick={() => { setFehler(''); setSchritt('schutz') }}>Zurück zu {passkeyName()}</button>}
        </form>
      )}

      {schritt === 'notfall' && (
        <div className="space-y-5">
          <div className="karte" id="notfallblatt">
            <p className="overline">Notfallblatt · {brand.appName}</p>
            <p className="mt-3 text-sm">Wiederherstellungscode für <b>{email}</b>:</p>
            <p className="code mt-2 break-all text-heading">{formatiereCode(notfallcode)}</p>
            <p className="mt-4 text-sm text-text-muted">Adresse: {typeof location !== 'undefined' ? location.origin : ''} · Erstellt am {new Date().toLocaleDateString('de-AT')}</p>
            <p className="mt-2 text-sm text-text-muted">Mit diesem Code lässt sich das Cockpit auf einem neuen Gerät entsperren, wenn kein eingerichtetes Gerät mehr da ist. Ausdrucken, nicht digital speichern, versiegelt bei der Vertrauensperson oder im Safe verwahren.</p>
          </div>
          <button type="button" className="btn btn-ghost nicht-drucken w-full" onClick={() => print()}>Notfallblatt drucken</button>
          <label className="nicht-drucken flex items-start gap-3 text-sm font-normal text-text"><input type="checkbox" checked={verwahrt} onChange={(e) => setVerwahrt(e.target.checked)} className="mt-0.5" /> Notfallblatt ist ausgedruckt und wird sicher verwahrt. Der Code wird nicht noch einmal angezeigt.</label>
          <Fehler text={fehler} />
          <button className="btn btn-cta nicht-drucken w-full" disabled={!verwahrt || !!arbeitet} onClick={abschliessen}>{arbeitet ?? 'Einrichtung abschließen'}</button>
        </div>
      )}
    </SchmalerRahmen>
  )
}

const UNTERTITEL: Record<Schritt, string> = {
  code: 'Mit der E-Mail-Adresse und dem Einrichtungscode von ICP.',
  'totp-bestehend': 'Code aus der Authenticator-App.',
  'totp-neu': 'Zweiter Faktor: Authenticator-App verbinden.',
  schutz: 'Schlüssel mit diesem Gerät sichern.',
  passphrase: 'Passphrase wählen – sie schützt alle Daten.',
  notfall: 'Notfallblatt sichern.',
}

function Fehler({ text }: { text: string }) {
  return <p className="fehler" role="alert">{text}</p>
}
