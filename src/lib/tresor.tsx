'use client'
// Der „Tresor“ hält die entpackten Zonen-Schlüssel nur im Arbeitsspeicher dieses Tabs.
// Sperre nach Inaktivität, beim Abmelden und beim Schließen des Tabs – danach sind die Schlüssel weg (Lösungsdesign 4.4).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Tresorinhalt, Zone } from './crypto/kern'

export const SPERRE_NACH_MIN = 60 // 02.10.2026 auf Wunsch der Beraterin von 10 auf 60 Minuten

type TresorKontext = {
  offen: boolean
  oeffnen: (schluessel: Tresorinhalt) => void
  sperren: () => void
  schluessel: (zone: Zone) => CryptoKey
}

const Kontext = createContext<TresorKontext | null>(null)

export function TresorProvider({ children }: { children: React.ReactNode }) {
  const inhalt = useRef<Tresorinhalt | null>(null)
  const [offen, setOffen] = useState(false)
  const letzteAktivitaet = useRef(Date.now())

  const sperren = useCallback(() => {
    inhalt.current = null
    setOffen(false)
  }, [])

  const oeffnen = useCallback((s: Tresorinhalt) => {
    inhalt.current = s
    letzteAktivitaet.current = Date.now()
    setOffen(true)
  }, [])

  const schluessel = useCallback((zone: Zone) => {
    if (!inhalt.current) throw new Error('Tresor ist gesperrt')
    return inhalt.current[zone]
  }, [])

  useEffect(() => {
    if (!offen) return
    const aktiv = () => { letzteAktivitaet.current = Date.now() }
    const ereignisse = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    ereignisse.forEach((e) => addEventListener(e, aktiv, { passive: true }))
    const timer = setInterval(() => {
      if (Date.now() - letzteAktivitaet.current > SPERRE_NACH_MIN * 60_000) sperren()
    }, 15_000)
    return () => { clearInterval(timer); ereignisse.forEach((e) => removeEventListener(e, aktiv)) }
  }, [offen, sperren])

  return <Kontext.Provider value={{ offen, oeffnen, sperren, schluessel }}>{children}</Kontext.Provider>
}

export function useTresor() {
  const k = useContext(Kontext)
  if (!k) throw new Error('useTresor außerhalb von TresorProvider')
  return k
}
