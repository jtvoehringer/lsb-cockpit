'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bestaetigung } from '@/components/Bestaetigung'
import { ladeEinstellungen, type PraxisEinstellungen } from '@/lib/einstellungen'
import { datum, heute, zahl } from '@/lib/format'
import { alsBezahlt, ausstellen, ladeHonorarnoten, offeneSitzungen, positionsBetrag, stornieren, summe, type Honorarnote, type Position } from '@/lib/finanzen/honorarnoten'
import { betragAusText, euro, ZAHLUNGSART, type Zahlungsart } from '@/lib/finanzen/modell'
import { protokolliere } from '@/lib/konto'
import { ladeAkten, ladeRegister, ladeSitzungen, type Akte, type Sitzung } from '@/lib/protokolle/daten'
import { ART } from '@/lib/protokolle/modell'
import { useTresor } from '@/lib/tresor'

const STATUS = { offen: 'offen', bezahlt: 'bezahlt', storniert: 'storniert' } as const

export default function Honorarnoten() {
  const tresor = useTresor()
  const router = useRouter()
  const [noten, setNoten] = useState<Honorarnote[] | null>(null)
  const [akten, setAkten] = useState<Akte[]>([])
  const [sitzungen, setSitzungen] = useState<Sitzung[]>([])
  const [einst, setEinst] = useState<PraxisEinstellungen | null>(null)
  const [fehler, setFehler] = useState('')
  const [neu, setNeu] = useState<null | { akte_id: string; gewaehlt: Set<string>; satz: string; datum: string; name: string; adresse: string; sofort: '' | Zahlungsart }>(null)
  const [registerFrage, setRegisterFrage] = useState(false)
  const [zahlung, setZahlung] = useState<null | { id: string; datum: string; art: Zahlungsart }>(null)
  const [arbeitet, setArbeitet] = useState(false)
  const kA = useCallback(() => tresor.schluessel('zone_a'), [tresor])

  const laden = useCallback(async () => {
    const [n, a, s, e] = await Promise.all([ladeHonorarnoten(kA()), ladeAkten(), ladeSitzungen(), ladeEinstellungen()])
    setNoten(n); setAkten(a); setSitzungen(s); setEinst(e)
  }, [kA])
  useEffect(() => { laden().catch((x) => setFehler(x.message)) }, [laden])

  const chiffreVon = useMemo(() => new Map(akten.map((a) => [a.id, a.chiffre])), [akten])
  const offen = neu ? offeneSitzungen(sitzungen, noten ?? [], neu.akte_id).sort((a, b) => a.datum.localeCompare(b.datum)) : []
  const satzZahl = neu ? betragAusText(neu.satz) ?? 0 : 0
  const positionen: Position[] = offen.filter((s) => neu?.gewaehlt.has(s.id)).map((s) => ({
    datum: s.datum, text: `${ART[s.art].kurz} (Lebens- und Sozialberatung)`, einheiten: Number(s.arbeitseinheiten ?? 0), satz: satzZahl, betrag: positionsBetrag(Number(s.arbeitseinheiten ?? 0), satzZahl),
  }))

  function neueNote(akte_id: string) {
    const o = offeneSitzungen(sitzungen, noten ?? [], akte_id)
    setNeu({ akte_id, gewaehlt: new Set(o.map((s) => s.id)), satz: einst?.honorarsatz ? String(einst.honorarsatz).replace('.', ',') : '', datum: heute(), name: '', adresse: '', sofort: '' })
  }

  async function ausRegister() {
    if (!neu) return
    setFehler('')
    const r = (await ladeRegister(tresor.schluessel('zone_c'))).find((x) => x.akte_id === neu.akte_id)
    await protokolliere('register_geoeffnet', 'für Honorarnote')
    setNeu({ ...neu, name: r?.name ?? '', adresse: r?.adresse ?? '' })
    setRegisterFrage(false)
    if (!r?.name) setFehler('Im Register ist zu dieser Chiffre noch kein Name eingetragen.')
  }

  async function ausstellenKlick() {
    if (!neu) return
    if (!neu.name.trim()) { setFehler('Bitte Name der Empfängerin / des Empfängers eintragen.'); return }
    if (!positionen.length) { setFehler('Bitte mindestens eine Sitzung wählen.'); return }
    if (!satzZahl) { setFehler('Bitte einen Honorarsatz eingeben (Voreinstellung unter „Einstellungen“).'); return }
    setArbeitet(true); setFehler('')
    try {
      const id = await ausstellen(kA(), { akte_id: neu.akte_id, chiffre: chiffreVon.get(neu.akte_id) ?? '', datum: neu.datum, sitzung_ids: offen.filter((s) => neu.gewaehlt.has(s.id)).map((s) => s.id), inhalt: { empfaenger: { name: neu.name.trim(), adresse: neu.adresse.trim() }, positionen, hinweis: einst?.hinweis ?? '' }, sofortBezahlt: neu.sofort || undefined })
      await protokolliere('honorarnote_ausgestellt')
      router.push(`/finanzen/honorarnoten/${id}`)
    } catch (x) { setFehler((x as Error).message); setArbeitet(false) }
  }

  async function bezahltSpeichern() {
    const n = noten?.find((x) => x.id === zahlung?.id)
    if (!n || !zahlung) return
    try { await alsBezahlt(kA(), n, chiffreVon.get(n.akte_id) ?? '', zahlung.datum, zahlung.art); await protokolliere('honorarnote_bezahlt', n.nummer); setZahlung(null); await laden() }
    catch (x) { setFehler((x as Error).message) }
  }

  async function storno(n: Honorarnote) {
    if (!confirm(`Honorarnote ${n.nummer} stornieren?${n.buchung_id ? ' Die gebuchte Einnahme wird entfernt.' : ''} Die Nummer bleibt vergeben.`)) return
    try { await stornieren(n); await protokolliere('honorarnote_storniert', n.nummer); await laden() } catch (x) { setFehler((x as Error).message) }
  }

  const aktenMitOffenen = akten.map((a) => ({ a, anzahl: offeneSitzungen(sitzungen, noten ?? [], a.id).length })).filter((x) => x.anzahl > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="overline"><Link href="/finanzen" className="no-underline">Finanzen</Link></p><h1 className="mt-2 font-heading text-heading">Honorarnoten</h1></div>
        {einst && !einst.name && <p className="hinweis text-sm">Absender und Bankdaten fehlen noch – bitte unter <Link href="/einstellungen">Einstellungen</Link> eintragen.</p>}
      </div>
      {fehler && <p className="fehler" role="alert">{fehler}</p>}

      {!neu && (
        <div className="karte flex flex-wrap items-end gap-3">
          <label className="min-w-64">Neue Honorarnote für
            <select defaultValue="" onChange={(e) => e.target.value && neueNote(e.target.value)} className="mt-1 block w-full rounded-md border border-border-input bg-surface px-3 py-2.5">
              <option value="">Chiffre wählen …</option>
              {aktenMitOffenen.map(({ a, anzahl }) => <option key={a.id} value={a.id}>{a.chiffre} · {anzahl} offene Sitzung{anzahl === 1 ? '' : 'en'}</option>)}
            </select>
          </label>
          {noten && aktenMitOffenen.length === 0 && <p className="text-sm text-text-muted">Keine abgeschlossenen, noch nicht abgerechneten Sitzungen.</p>}
        </div>
      )}

      {neu && (
        <div className="karte space-y-4">
          <h2 className="font-heading text-heading">Neue Honorarnote · {chiffreVon.get(neu.akte_id)}</h2>
          <div className="space-y-1">
            {offen.map((s) => (
              <label key={s.id} className="flex items-center gap-3 text-sm font-normal text-text">
                <input type="checkbox" checked={neu.gewaehlt.has(s.id)} onChange={(e) => { const g = new Set(neu.gewaehlt); if (e.target.checked) g.add(s.id); else g.delete(s.id); setNeu({ ...neu, gewaehlt: g }) }} />
                <span className="tabular-nums">{datum(s.datum)}</span> · Nr. {s.nr} · {ART[s.art].kurz} · {zahl(Number(s.arbeitseinheiten ?? 0))} Einheiten
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label>Datum der Honorarnote<input type="date" value={neu.datum} onChange={(e) => setNeu({ ...neu, datum: e.target.value })} /></label>
            <label>Honorar je Einheit (€)<input inputMode="decimal" value={neu.satz} onChange={(e) => setNeu({ ...neu, satz: e.target.value })} /></label>
            <div><span className="block text-[13px] font-medium text-text-muted">Summe</span><b className="mt-2 block text-xl tabular-nums">{euro(summe(positionen))}</b></div>
            <label className="sm:col-span-2">Empfänger:in (Name)<input value={neu.name} onChange={(e) => setNeu({ ...neu, name: e.target.value })} autoComplete="off" /></label>
            <div className="flex items-end">
              {registerFrage
                ? <div className="w-full"><Bestaetigung knopf="Aus Register holen" ereignis="register_geoeffnet" weiter={ausRegister} /></div>
                : <button type="button" className="btn btn-ghost w-full" onClick={() => setRegisterFrage(true)}>Aus Register übernehmen …</button>}
            </div>
            <label className="sm:col-span-3">Adresse (mehrzeilig möglich)<textarea value={neu.adresse} onChange={(e) => setNeu({ ...neu, adresse: e.target.value })} rows={3} className="mt-1 block w-full rounded-md border border-border-input bg-surface p-3" /></label>
            <label>Bereits bezahlt?<select value={neu.sofort} onChange={(e) => setNeu({ ...neu, sofort: e.target.value as '' | Zahlungsart })} className="mt-1 block w-full rounded-md border border-border-input bg-surface px-3 py-2.5">
              <option value="">Nein – Überweisung offen</option><option value="bar">Ja, bar</option><option value="karte">Ja, mit Karte</option><option value="bank">Ja, bereits überwiesen</option>
            </select></label>
          </div>
          <p className="text-xs text-text-subtle">Name und Adresse werden verschlüsselt gespeichert. Die Einnahme wird gebucht, sobald die Zahlung da ist (Zufluss-Prinzip).</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => { setNeu(null); setFehler('') }}>Abbrechen</button>
            <button className="btn btn-cta" disabled={arbeitet} onClick={() => void ausstellenKlick()}>{arbeitet ? 'Wird ausgestellt …' : 'Honorarnote ausstellen'}</button>
          </div>
        </div>
      )}

      <div className="karte overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-widest text-text-subtle">{['Nr.', 'Datum', 'Chiffre', 'Betrag', 'Status', ''].map((h, i) => <th key={i} className={`px-4 py-3 font-medium ${i === 3 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>{(noten ?? []).map((n) => (
            <tr key={n.id} className={`border-t border-border ${n.status === 'storniert' ? 'text-text-subtle line-through' : ''}`}>
              <td className="whitespace-nowrap px-4 py-2 tabular-nums"><Link href={`/finanzen/honorarnoten/${n.id}`}>{n.nummer}</Link></td>
              <td className="px-4 tabular-nums">{datum(n.datum)}</td>
              <td className="whitespace-nowrap px-4 tabular-nums">{chiffreVon.get(n.akte_id)}</td>
              <td className="px-4 text-right tabular-nums">{euro(n.betrag)}</td>
              <td className="px-4">{STATUS[n.status]}{n.status === 'bezahlt' && n.bezahlt_am ? ` am ${datum(n.bezahlt_am)}` : ''}</td>
              <td className="whitespace-nowrap px-4 no-underline">
                {n.status === 'offen' && (zahlung?.id === n.id ? (
                  <span className="inline-flex items-center gap-1">
                    <input type="date" aria-label="Zahlungsdatum" value={zahlung.datum} onChange={(e) => setZahlung({ ...zahlung, datum: e.target.value })} className="!mt-0 !w-36 !py-1" />
                    <select aria-label="Zahlungsart" value={zahlung.art} onChange={(e) => setZahlung({ ...zahlung, art: e.target.value as Zahlungsart })} className="rounded-md border border-border-input px-2 py-1.5">{Object.entries(ZAHLUNGSART).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                    <button className="btn btn-cta px-3 py-1 text-xs" onClick={() => void bezahltSpeichern()}>Buchen</button>
                  </span>
                ) : <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => setZahlung({ id: n.id, datum: heute(), art: 'bank' })}>Als bezahlt</button>)}
                {n.status !== 'storniert' && <button className="btn btn-ghost ml-1 px-3 py-1 text-xs text-accent-strong" onClick={() => void storno(n)}>Stornieren</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
        {noten && noten.length === 0 && <p className="p-6 text-text-muted">Noch keine Honorarnoten.</p>}
        {!noten && !fehler && <p className="p-6 text-text-muted">Wird geladen und entschlüsselt …</p>}
      </div>
    </div>
  )
}
