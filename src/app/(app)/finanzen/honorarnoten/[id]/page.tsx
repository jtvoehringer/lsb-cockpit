'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ladeEinstellungen, type PraxisEinstellungen } from '@/lib/einstellungen'
import { datum, zahl } from '@/lib/format'
import { ladeHonorarnoten, type Honorarnote } from '@/lib/finanzen/honorarnoten'
import { euro } from '@/lib/finanzen/modell'
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
  const faellig = new Date(n.datum + 'T12:00'); faellig.setDate(faellig.getDate() + (e.zahlungsziel_tage || 0))

  return (
    <div className="space-y-4">
      <div className="nicht-drucken flex flex-wrap items-center justify-between gap-2">
        <Link href="/finanzen/honorarnoten" className="btn btn-ghost no-underline">← Zurück zu den Honorarnoten</Link>
        <button className="btn btn-primary" onClick={() => { document.title = `Honorarnote ${n.nummer}`; print() }}>Drucken / PDF</button>
      </div>

      <article className="honorarnote relative mx-auto max-w-[210mm] bg-white p-10 text-[10.5pt] leading-relaxed text-ink shadow-[var(--shadow-paper)] print:p-0 print:shadow-none">
        {n.status === 'storniert' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-bold tracking-widest text-accent-strong/20 -rotate-12">STORNIERT</div>}
        <header className="flex justify-between gap-8">
          <div className="pt-24 text-sm">
            <p className="mb-2 text-[8pt] text-text-subtle">{[e.name, e.strasse, e.plz_ort].filter(Boolean).join(' · ')}</p>
            <p className="font-medium">{n.inhalt.empfaenger.name}</p>
            {n.inhalt.empfaenger.adresse.split('\n').map((z, i) => <p key={i}>{z}</p>)}
          </div>
          <div className="text-right text-sm">
            <img src="/brand/bildmarke.svg" alt="" width={48} height={36} className="ml-auto" />
            <p className="mt-3 font-heading text-lg text-heading">{e.name || '– Absender unter Einstellungen –'}</p>
            <p className="text-text-muted">{e.berufsbezeichnung}</p>
            <p>{e.strasse}</p><p>{e.plz_ort}</p>
            {e.telefon && <p>Tel. {e.telefon}</p>}{e.email && <p>{e.email}</p>}
          </div>
        </header>

        <h1 className="mt-12 font-heading text-2xl text-heading">Honorarnote Nr. {n.nummer}</h1>
        <p className="text-sm">Datum: {datum(n.datum)}</p>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead><tr className="border-b border-ink text-left"><th className="py-1.5 font-semibold">Datum</th><th className="font-semibold">Leistung</th><th className="text-right font-semibold">Einheiten</th><th className="text-right font-semibold">je Einheit</th><th className="text-right font-semibold">Betrag</th></tr></thead>
          <tbody>{n.inhalt.positionen.map((p, i) => (
            <tr key={i} className="border-b border-border"><td className="py-1.5 tabular-nums">{datum(p.datum)}</td><td>{p.text}</td><td className="text-right tabular-nums">{zahl(p.einheiten)}</td><td className="text-right tabular-nums">{euro(p.satz)}</td><td className="text-right tabular-nums">{euro(p.betrag)}</td></tr>
          ))}</tbody>
          <tfoot><tr><td colSpan={4} className="pt-3 text-right font-semibold">Gesamtbetrag</td><td className="pt-3 text-right font-semibold tabular-nums">{euro(n.betrag)}</td></tr></tfoot>
        </table>
        <p className="mt-2 text-xs text-text-muted">Eine Einheit entspricht 50 Minuten.</p>

        {n.inhalt.hinweis && <p className="mt-6 text-sm">{n.inhalt.hinweis}</p>}
        {n.status === 'bezahlt' && n.bezahlt_am
          ? <p className="mt-4 text-sm">Betrag dankend erhalten am {datum(n.bezahlt_am)}.</p>
          : n.status === 'offen' && (
            <div className="mt-4 text-sm">
              <p>Zahlbar bis {datum(faellig.toISOString().slice(0, 10))} ohne Abzug auf folgendes Konto:</p>
              <p className="mt-1 tabular-nums">{e.name}{e.bank ? ` · ${e.bank}` : ''}<br />IBAN {e.iban || '–'}{e.bic ? ` · BIC ${e.bic}` : ''}<br />Verwendungszweck: Honorarnote {n.nummer}</p>
            </div>
          )}
        <p className="mt-10 text-sm">Vielen Dank für das entgegengebrachte Vertrauen.</p>
      </article>
    </div>
  )
}
