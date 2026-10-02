'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SchmalerRahmen } from '@/components/Rahmen'

// Öffentliche Seite zum Verschicken (lsb.icp-consultants.at/installieren): erkennt das Gerät und führt durch die Installation als App.
// Edge/Chrome bieten über „beforeinstallprompt“ einen echten Installieren-Knopf; Safari am iPhone nur den Weg über „Teilen“.

type InstallEreignis = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
type Lage = 'laedt' | 'installiert' | 'ios' | 'knopf' | 'chromium' | 'anderer'

export default function Installieren() {
  const [lage, setLage] = useState<Lage>('laedt')
  const [ereignis, setEreignis] = useState<InstallEreignis | null>(null)
  const [fertig, setFertig] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    const chromium = /Chrome|Chromium|Edg\//.test(ua) && !ios
    setLage(standalone ? 'installiert' : ios ? 'ios' : chromium ? 'chromium' : 'anderer')

    const bereit = (e: Event) => { e.preventDefault(); setEreignis(e as InstallEreignis); setLage('knopf') }
    const installiert = () => setFertig(true)
    addEventListener('beforeinstallprompt', bereit)
    addEventListener('appinstalled', installiert)
    return () => { removeEventListener('beforeinstallprompt', bereit); removeEventListener('appinstalled', installiert) }
  }, [])

  async function installieren() {
    if (!ereignis) return
    await ereignis.prompt()
    const { outcome } = await ereignis.userChoice
    if (outcome === 'accepted') setFertig(true)
    setEreignis(null)
  }

  if (fertig) return (
    <SchmalerRahmen titel="Installiert" untertitel="Das Cockpit ist jetzt als App auf diesem Gerät.">
      <p>Du findest es im Startmenü bzw. auf dem Home-Bildschirm unter „LSB Cockpit“. Beim ersten Start meldest du dich wie gewohnt an.</p>
    </SchmalerRahmen>
  )

  return (
    <SchmalerRahmen titel="Cockpit als App installieren" untertitel="Dann startet das Cockpit wie ein eigenes Programm – mit eigenem Symbol und ohne Browserleiste.">
      <div className="space-y-6">
        {lage === 'laedt' && <p className="text-text-muted">Gerät wird erkannt …</p>}

        {lage === 'installiert' && (
          <div className="karte space-y-3">
            <p>Du verwendest das Cockpit bereits als App.</p>
            <Link href="/anmelden" className="btn btn-primary no-underline">Zum Cockpit</Link>
          </div>
        )}

        {lage === 'knopf' && (
          <div className="karte space-y-3">
            <p>Ein Klick genügt – danach bestätigst du im Fenster des Browsers mit „Installieren“.</p>
            <button className="btn btn-cta" onClick={() => void installieren()}>Cockpit installieren</button>
          </div>
        )}

        {lage === 'chromium' && (
          <div className="karte space-y-3">
            <p>In der Adressleiste rechts auf das Symbol <b>„App installieren“</b> klicken (Bildschirm mit Pfeil) und mit „Installieren“ bestätigen.</p>
            <p className="text-sm text-text-muted">Kein Symbol zu sehen? Menü <b>⋯</b> oben rechts → <b>Apps</b> (bzw. „Streamen, speichern und teilen“) → <b>„LSB Cockpit installieren“</b>. Steht dort „Öffnen“, ist das Cockpit schon installiert.</p>
          </div>
        )}

        {lage === 'ios' && (
          <div className="karte space-y-3">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Diese Seite in <b>Safari</b> öffnen.</li>
              <li>Neben der Adresszeile auf <b>„⋯“</b> tippen und dann <b>„Teilen“</b> wählen. (Ältere iPhones: direkt das Teilen-Symbol – Quadrat mit Pfeil nach oben.)</li>
              <li>Nach unten wischen und <b>„Zum Home-Bildschirm“</b> wählen.</li>
              <li>Der Schalter <b>„Als Web-App öffnen“</b> muss eingeschaltet sein – dann oben rechts auf <b>„Hinzufügen“</b> tippen.</li>
            </ol>
            <p className="text-sm text-text-muted">Das Cockpit liegt dann als „Cockpit“ auf dem Home-Bildschirm. Face ID zum Entsperren funktioniert dort genauso.</p>
          </div>
        )}

        {lage === 'anderer' && (
          <div className="karte space-y-3">
            <p>Dieser Browser kann das Cockpit nicht als App installieren. Bitte die Seite in <b>Microsoft Edge</b> oder <b>Google Chrome</b> öffnen (am iPhone in <b>Safari</b>) und dort installieren.</p>
          </div>
        )}

        <div className="text-sm text-text-muted">
          <p>Die App ist dasselbe Cockpit unter derselben Adresse: gleiche Anmeldung, gleiche Passkeys, gleiche Daten. Ohne Internet funktioniert sie nicht.</p>
          <p className="mt-3"><Link href="/anmelden">Ohne Installation weiter zur Anmeldung</Link></p>
        </div>
      </div>
    </SchmalerRahmen>
  )
}
