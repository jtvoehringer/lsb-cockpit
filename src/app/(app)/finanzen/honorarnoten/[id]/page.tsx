'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { HonorarnoteDokument } from '@/components/HonorarnoteDokument'
import { ladeEinstellungen, type PraxisEinstellungen } from '@/lib/einstellungen'
import { ladeHonorarnoten, type Honorarnote } from '@/lib/finanzen/honorarnoten'
import { useTresor } from '@/lib/tresor'

/** Ansicht und Druckfassung (A4) einer Honorarnote. PDF über den Druckdialog des Browsers – nichts verlässt das Gerät. */
export default function HonorarnoteAnsicht() {
  const { id } = useParams<{ id: string }>()
  const tresor = useTresor()
  const [n, setN] = useState<Honorarnote | null>(null)
  const [e, setE] = useState<PraxisEinstellungen | null>(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    Promise.all([ladeHonorarnoten(tresor.schluessel('zone_a')), ladeEinstellungen()])
      .then(([alle, einst]) => { const x = alle.find((h) => h.id === id); if (!x) throw new Error('Honorarnote nicht gefunden'); setN(x); setE(einst) })
      .catch((x) => setFehler(x.message))
  }, [id, tresor])

  if (fehler) return <p className="fehler">{fehler}</p>
  if (!n || !e) return <p className="text-text-muted">Wird geladen und entschlüsselt …</p>

  return (
    <div className="space-y-4">
      <div className="nicht-drucken flex flex-wrap items-center justify-between gap-2">
        <Link href="/finanzen/honorarnoten" className="btn btn-ghost no-underline">← Zurück zu den Honorarnoten</Link>
        <button className="btn btn-primary" onClick={() => { document.title = `Honorarnote ${n.nummer}`; print() }}>Drucken / PDF</button>
      </div>

      <HonorarnoteDokument n={n} e={e} />
    </div>
  )
}
