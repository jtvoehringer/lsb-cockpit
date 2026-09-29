'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SchmalerRahmen } from '@/components/Rahmen'
import { datum, zeitpunkt } from '@/lib/format'
import { abmelden, aktiveFreigabe, ladeAudit, ladeFreigaben, protokolliere, rolle, sicherheitsstufe, type Freigabe } from '@/lib/konto'
import { ART } from '@/lib/protokolle/modell'
import { supabaseBrowser } from '@/lib/supabase/client'

// Support-Ansicht (ICP): nur mit aktiver Freigabe der Beraterin, technisch ohne Inhalte.
// Sichtbar: Einstellungen, Chiffren, Termine/Status, Audit. Nicht sichtbar: Namen, Protokollinhalte, Finanzen, Register.
type Akte = { id: string; chiffre: string; status: string; erstellt_am: string }
type Sitzung = { id: string; akte_id: string; nr: number; art: 'erst' | 'folge'; datum: string; protokoll_status: string; geaendert_am: string }

export default function Support() {
  const router = useRouter()
  const [status, setStatus] = useState<'laedt' | 'kein-support' | 'keine-freigabe' | 'frei'>('laedt')
  const [freigabe, setFreigabe] = useState<Freigabe | null>(null)
  const [einst, setEinst] = useState<Record<string, unknown> | null>(null)
  const [akten, setAkten] = useState<Akte[]>([])
  const [sitzungen, setSitzungen] = useState<Sitzung[]>([])
  const [audit, setAudit] = useState<{ zeitpunkt: string; ereignis: string; objekt: string | null; ergebnis: string | null }[]>([])

  useEffect(() => {
    (async () => {
      const s = await sicherheitsstufe()
      if (!s.aal2) { router.replace('/anmelden'); return }
      if ((await rolle()) !== 'support') { setStatus('kein-support'); return }
      const f = aktiveFreigabe(await ladeFreigaben())
      setFreigabe(f)
      if (!f) { setStatus('keine-freigabe'); return }
      const sb = supabaseBrowser()
      const [p, a, z, au] = await Promise.all([
        sb.from('praxis').select('einstellungen').maybeSingle(),
        sb.from('akte').select('id, chiffre, status, erstellt_am').order('erstellt_am', { ascending: false }),
        sb.from('sitzung').select('id, akte_id, nr, art, datum, protokoll_status, geaendert_am').order('datum', { ascending: false }).limit(200),
        ladeAudit(50),
      ])
      const e = { ...((p.data?.einstellungen as Record<string, unknown>) ?? {}) }
      const hn = e.honorarnote as Record<string, unknown> | undefined
      if (hn?.iban) e.honorarnote = { ...hn, iban: `${String(hn.iban).slice(0, 4)} … (ausgeblendet)` }
      setEinst(e); setAkten((a.data ?? []) as Akte[]); setSitzungen((z.data ?? []) as Sitzung[]); setAudit(au)
      setStatus('frei')
      await protokolliere('support_zugriff', 'Support-Ansicht geöffnet')
    })().catch(() => setStatus('keine-freigabe'))
  }, [router])

  const raus = async () => { await abmelden(); router.replace('/anmelden') }

  if (status === 'laedt') return <SchmalerRahmen titel="Support"><p className="text-text-muted">Wird geprüft …</p></SchmalerRahmen>
  if (status === 'kein-support') return <SchmalerRahmen titel="Support"><p>Diese Seite ist nur für das Support-Konto von ICP.</p><button className="btn btn-ghost mt-6" onClick={() => router.replace('/')}>Zur Übersicht</button></SchmalerRahmen>
  if (status === 'keine-freigabe') return (
    <SchmalerRahmen titel="Support" untertitel="Keine aktive Freigabe.">
      <p>Der Zugang ist erst möglich, wenn die Beraterin ihn unter „Schutz &amp; Audit“ → „Support-Freigabe“ befristet freigibt. Jede Nutzung wird protokolliert.</p>
      <button className="btn btn-ghost mt-6" onClick={() => void raus()}>Abmelden</button>
    </SchmalerRahmen>
  )

  const chiffreVon = new Map(akten.map((a) => [a.id, a.chiffre]))
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="overline">Support · technisch, ohne Inhalte</p><h1 className="mt-2 font-heading text-heading">Support-Ansicht</h1></div>
        <div className="flex items-center gap-3 text-sm"><span className="hinweis">Freigegeben bis {zeitpunkt(freigabe?.gueltig_bis)}</span><button className="btn btn-ghost" onClick={() => void raus()}>Abmelden</button></div>
      </div>
      <p className="text-sm text-text-muted">Namen, Protokollinhalte, Register und Finanzen sind für den Support nicht zugänglich – sie sind verschlüsselt und der Support hat keinen Schlüssel. Diese Ansicht wird im Audit-Protokoll der Beraterin vermerkt.</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="karte p-5"><span className="text-xs text-text-subtle">Akten (Chiffren)</span><b className="block font-heading text-3xl font-normal">{akten.length}</b></div>
        <div className="karte p-5"><span className="text-xs text-text-subtle">Sitzungen</span><b className="block font-heading text-3xl font-normal">{sitzungen.length}</b></div>
        <div className="karte p-5"><span className="text-xs text-text-subtle">Entwürfe offen</span><b className="block font-heading text-3xl font-normal">{sitzungen.filter((s) => s.protokoll_status === 'entwurf').length}</b></div>
      </div>

      <div className="karte overflow-x-auto p-0">
        <h2 className="px-4 pt-4 font-heading text-heading">Termine (letzte 200)</h2>
        <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-widest text-text-subtle"><th className="px-4 py-2 font-medium">Nr.</th><th className="font-medium">Datum</th><th className="font-medium">Chiffre</th><th className="font-medium">Art</th><th className="font-medium">Status</th><th className="font-medium">Geändert</th></tr></thead>
          <tbody>{sitzungen.map((s) => <tr key={s.id} className="border-t border-border"><td className="px-4 py-1.5 tabular-nums">{s.nr}</td><td className="tabular-nums">{datum(s.datum)}</td><td className="tabular-nums">{chiffreVon.get(s.akte_id)}</td><td>{ART[s.art]?.kurz}</td><td>{s.protokoll_status}</td><td className="tabular-nums">{zeitpunkt(s.geaendert_am)}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="karte overflow-x-auto p-0">
        <h2 className="px-4 pt-4 font-heading text-heading">Audit-Protokoll (letzte 50)</h2>
        <table className="mt-2 w-full text-sm"><tbody>{audit.map((a, i) => <tr key={i} className="border-t border-border"><td className="px-4 py-1.5 tabular-nums">{zeitpunkt(a.zeitpunkt)}</td><td>{a.ereignis}</td><td>{a.objekt}</td><td>{a.ergebnis}</td></tr>)}</tbody></table>
      </div>

      <div className="karte">
        <h2 className="font-heading text-heading">Einstellungen</h2>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(einst, null, 2)}</pre>
      </div>
    </main>
  )
}
