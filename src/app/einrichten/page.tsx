'use client'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { SchmalerRahmen } from '@/components/Rahmen'
import brand from '@/config/brand.config'
import { formatiereCode } from '@/lib/crypto/kern'
import { pruefePassphrase } from '@/lib/crypto/passphrase'
import { anmelden, einrichtungAbschliessen, ladeSchluesselbund, schluesselEinrichten, totpAnlegen, totpBestaetigen, tresorOeffnen } from '@/lib/konto'
import { useTresor } from '@/lib/tresor'

type Schritt = 'code' | 'totp-bestehend' | 'passphrase' | 'totp-neu' | 'notfall'

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
  const [notfallcode, setNotfallcode] = useState('')
  const [verwahrt, setVerwahrt] = useState(false)
  const [arbeitet, setArbeitet] = useState<string | null>(null)
  const [fehler, setFehler] = useState('')
  const pruefung = useMemo(() => pruefePassphrase(p1, email), [p1, email])

  async function laufe(text: string, f: () => Promise<void>) {
    setFehler(''); setArbeitet(text)
    try { await f() } catch (err) { setFehler((err as Error).message) } finally { setArbeitet(null) }
  }

  const mitCode = (e: React.FormEvent) => { e.preventDefault(); void laufe('Wird geprüft …', async () => {
    const { faktorId } = await anmelden(email, einrichtungscode.trim())
    setEinrichtungscode('')
    if (faktorId) { setFaktorId(faktorId); setSchritt('totp-bestehend') } else setSchritt('passphrase')
  }) }

  const bestehendenTotpPruefen = (e: React.FormEvent) => { e.preventDefault(); void laufe('Wird geprüft …', async () => {
    await totpBestaetigen(faktorId!, totpCode); setTotpCode('')
    if ((await ladeSchluesselbund()).some((s) => s.art === 'master')) { router.replace('/anmelden'); return }
    setSchritt('passphrase')
  }) }

  const passphraseWaehlen = (e: React.FormEvent) => { e.preventDefault()
    if (!pruefung.ok) { setFehler(pruefung.hinweise.join(' ')); return }
    if (p1 !== p2) { setFehler('Die beiden Eingaben stimmen nicht überein.'); return }
    if (!verstanden) { setFehler('Bitte die Bestätigung ankreuzen.'); return }
    void laufe('Authenticator wird vorbereitet …', async () => {
      if (faktorId) { await schluesselErzeugen(); return } // TOTP ist schon eingerichtet und bestätigt
      setTotp(await totpAnlegen()); setSchritt('totp-neu')
    })
  }

  const neuenTotpBestaetigen = (e: React.FormEvent) => { e.preventDefault(); void laufe('Wird geprüft …', async () => {
    await totpBestaetigen(totp!.faktorId, totpCode); setTotpCode('')
    await schluesselErzeugen()
  }) }

  async function schluesselErzeugen() {
    setArbeitet('Schlüssel werden erzeugt …')
    setNotfallcode(await schluesselEinrichten(email, p1))
    setSchritt('notfall')
  }

  const abschliessen = () => void laufe('Tresor wird geöffnet …', async () => {
    tresor.oeffnen(await tresorOeffnen(p1))
    await einrichtungAbschliessen()
    setP1(''); setP2(''); setNotfallcode('')
    router.replace('/')
  })

  return (
    <SchmalerRahmen titel="Konto einrichten" untertitel={UNTERTITEL[schritt]}>
      {schritt === 'code' && (
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

      {schritt === 'passphrase' && (
        <form onSubmit={passphraseWaehlen} className="space-y-5">
          <div className="hinweis space-y-2">
            <p><b>So funktioniert der Schutz:</b> Alle Inhalte werden auf diesem Gerät mit einem Schlüssel aus deiner Passphrase verschlüsselt. Niemand sonst kann sie lesen – auch ICP, Supabase und Vercel nicht.</p>
            <p>Deshalb: <b>Gehen Passphrase und Notfallblatt verloren, sind die Daten verloren.</b> Ein Zurücksetzen per E-Mail gibt es nicht.</p>
          </div>
          <label>Passphrase<input type="password" autoComplete="new-password" required value={p1} onChange={(e) => setP1(e.target.value)} /></label>
          <p className="text-sm text-text-muted">Mindestens 16 Zeichen oder 5 Wörter – z. B. fünf zufällige Wörter. Aufschreiben und sicher verwahren.</p>
          {p1 && !pruefung.ok && <ul className="list-disc pl-5 text-sm text-text-muted">{pruefung.hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}
          <label>Passphrase wiederholen<input type="password" autoComplete="new-password" required value={p2} onChange={(e) => setP2(e.target.value)} /></label>
          <label className="flex items-start gap-3 text-sm font-normal text-text"><input type="checkbox" checked={verstanden} onChange={(e) => setVerstanden(e.target.checked)} className="mt-0.5" /> Ich habe verstanden: Ohne Passphrase und ohne Notfallblatt sind die Daten nicht wiederherstellbar.</label>
          <Fehler text={fehler} />
          <button className="btn btn-cta w-full" disabled={!!arbeitet}>{arbeitet ?? 'Weiter'}</button>
        </form>
      )}

      {schritt === 'totp-neu' && totp && (
        <form onSubmit={neuenTotpBestaetigen} className="space-y-5">
          <p>Authenticator-App öffnen (z. B. Microsoft Authenticator oder Google Authenticator), „Konto hinzufügen“ wählen und diesen QR-Code scannen:</p>
          <div className="karte flex justify-center"><img src={totp.qrCode} alt="QR-Code für die Authenticator-App" width={200} height={200} /></div>
          <details className="text-sm text-text-muted"><summary>QR-Code lässt sich nicht scannen?</summary><p className="mt-2">Schlüssel manuell eingeben: <span className="code text-base break-all">{totp.geheimnis}</span></p></details>
          <label>Sechsstelliger Code aus der App<input inputMode="numeric" autoComplete="one-time-code" required value={totpCode} onChange={(e) => setTotpCode(e.target.value)} className="code" /></label>
          <Fehler text={fehler} />
          <button className="btn btn-cta w-full" disabled={!!arbeitet}>{arbeitet ?? 'Bestätigen'}</button>
        </form>
      )}

      {schritt === 'notfall' && (
        <div className="space-y-5">
          <div className="karte" id="notfallblatt">
            <p className="overline">Notfallblatt · {brand.appName}</p>
            <p className="mt-3 text-sm">Wiederherstellungscode für <b>{email}</b>:</p>
            <p className="code mt-2 break-all text-heading">{formatiereCode(notfallcode)}</p>
            <p className="mt-4 text-sm text-text-muted">Adresse: {typeof location !== 'undefined' ? location.origin : ''} · Erstellt am {new Date().toLocaleDateString('de-AT')}</p>
            <p className="mt-2 text-sm text-text-muted">Mit diesem Code lässt sich bei vergessener Passphrase eine neue setzen (zusammen mit ICP). Ausdrucken, nicht digital speichern, versiegelt bei der Vertrauensperson oder im Safe verwahren.</p>
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
  passphrase: 'Passphrase wählen – sie schützt alle Daten.',
  'totp-neu': 'Zweiter Faktor: Authenticator-App verbinden.',
  notfall: 'Notfallblatt sichern.',
}

function Fehler({ text }: { text: string }) {
  return <p className="fehler" role="alert">{text}</p>
}
