'use client'
import { useEffect, useRef, useState } from 'react'
import { aufnehmen, beiStatus, umwandeln, vorbereiten, ZuLeise } from '@/lib/diktat'

type Props = { id: string; titel: string; wert: string; gesperrt: boolean; aufAenderung: (text: string) => void; aufnahmeLaeuft: boolean; setzeAufnahme: (an: boolean) => void }

/** Textfeld mit „Diktieren“: Text wird angehängt, danach gegenlesen */
export function DiktatFeld({ id, titel, wert, gesperrt, aufAenderung, aufnahmeLaeuft, setzeAufnahme }: Props) {
  const [aktiv, setAktiv] = useState(false)
  const [status, setStatus] = useState('')
  const stopp = useRef<null | (() => Promise<Blob>)>(null)
  const wertRef = useRef(wert)
  wertRef.current = wert

  useEffect(() => (aktiv ? beiStatus(setStatus) : undefined), [aktiv])

  async function umschalten() {
    if (!aktiv) {
      try {
        stopp.current = await aufnehmen()
        vorbereiten()
        setAktiv(true); setzeAufnahme(true)
        setStatus('Aufnahme läuft – sprechen, dann „Stopp“.')
      } catch { setStatus('Kein Zugriff auf das Mikrofon. Bitte im Browser erlauben.') }
      return
    }
    const blob = await stopp.current!()
    stopp.current = null
    setzeAufnahme(false)
    setStatus('Wird in Text umgewandelt … (auf diesem Gerät)')
    try {
      const r = await umwandeln(blob)
      if (r.text) {
        const alt = wertRef.current.trimEnd()
        aufAenderung(alt ? `${alt}\n${r.text}` : r.text)
        setStatus(`Übernommen (${(r.ms / 1000).toFixed(1).replace('.', ',')} s). Bitte gegenlesen.`)
      } else setStatus('Nichts erkannt – bitte noch einmal.')
    } catch (e) {
      setStatus(e instanceof ZuLeise ? e.message : `Spracherkennung fehlgeschlagen: ${(e as Error).message}`)
    } finally { setAktiv(false) }
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`h-${id}`} className="font-heading text-xl text-heading">{titel}</h2>
        {!gesperrt && (
          <button type="button" onClick={umschalten} disabled={aufnahmeLaeuft && !aktiv}
            className={`btn px-3 py-1.5 text-sm ${aktiv ? 'btn-cta' : 'btn-ghost'}`} aria-describedby={`h-${id}`}>
            {aktiv ? '● Stopp' : 'Diktieren'}
          </button>
        )}
      </div>
      <textarea aria-labelledby={`h-${id}`} value={wert} readOnly={gesperrt} spellCheck
        onChange={(e) => aufAenderung(e.target.value)}
        className="min-h-32 w-full rounded-md border border-border-input bg-surface p-3 text-base read-only:bg-background" />
      <p className="min-h-5 text-xs text-text-subtle" aria-live="polite">{status}</p>
    </div>
  )
}
