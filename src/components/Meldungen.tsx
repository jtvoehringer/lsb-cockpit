'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { holeMeldung, MELDUNG_EREIGNIS } from '@/lib/meldung'

/** Zeigt Erfolgsmeldungen unten am Bildschirm; verschwindet nach 6 Sekunden oder per Klick. */
export function Meldungen() {
  const pfad = usePathname()
  const [text, setText] = useState('')

  useEffect(() => {
    const neu = () => { const t = holeMeldung(); if (t) setText(t) }
    neu() // nach Seitenwechsel
    addEventListener(MELDUNG_EREIGNIS, neu)
    return () => removeEventListener(MELDUNG_EREIGNIS, neu)
  }, [pfad])

  useEffect(() => {
    if (!text) return
    const t = setTimeout(() => setText(''), 6000)
    return () => clearTimeout(t)
  }, [text])

  if (!text) return null
  return (
    <div className="nicht-drucken fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <button type="button" onClick={() => setText('')} className="flex max-w-xl items-start gap-3 rounded-lg bg-forest px-5 py-3 text-left text-sm text-linen shadow-lg">
        <span aria-hidden className="font-semibold">✓</span><span>{text}</span>
      </button>
    </div>
  )
}
