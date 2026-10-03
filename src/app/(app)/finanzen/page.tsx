'use client'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import brand from '@/config/brand.config'
import { datum, heute } from '@/lib/format'
import {
  belegHochladen, belegLoeschen, belegOeffnen, buchungLoeschen, buchungSpeichern, jahressummen, kategorieAendern, kategorieAnlegen,
  ladeBuchungen, ladeKategorien, MAX_BELEG_BYTES, type BelegInfo, type Buchung, type Kategorie,
} from '@/lib/finanzen/daten'
import { betragAusText, euro, FIN_ART, jahresuebersicht, MONATE, ZAHLUNGSART, type FinArt, type Summenzeile, type Zahlungsart } from '@/lib/finanzen/modell'
import { protokolliere } from '@/lib/konto'
import { zeigeMeldung } from '@/lib/meldung'
import { useTresor } from '@/lib/tresor'

type Ansicht = 'uebersicht' | 'buchungen' | 'kategorien'
type Formular = { id?: string; art: FinArt; datum: string; betrag: string; kategorie_id: string; zahlungsart: Zahlungsart; beschreibung: string; dateien: File[] }
const leer = (art: FinArt = 'einnahme'): Formular => ({ art, datum: heute(), betrag: '', kategorie_id: '', zahlungsart: 'bank', beschreibung: '', dateien: [] })

export default function Finanzen() {
  const tresor = useTresor()
  const [ansicht, setAnsicht] = useState<Ansicht>('uebersicht')
  const [jahr, setJahr] = useState(new Date().getFullYear())
  const [kategorien, setKategorien] = useState<Kategorie[]>([])
  const [summen, setSummen] = useState<Summenzeile[]>([])
  const [buchungen, setBuchungen] = useState<Buchung[] | null>(null)
  const [filter, setFilter] = useState({ monat: 0, art: '' as '' | FinArt })
  const [form, setForm] = useState<Formular | null>(null)
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [neueKat, setNeueKat] = useState({ name: '', art: 'ausgabe' as FinArt })

  const kA = useCallback(() => tresor.schluessel('zone_a'), [tresor])
  const laden = useCallback(async () => {
    const [k, s, b] = await Promise.all([ladeKategorien(), jahressummen(jahr), ladeBuchungen(kA(), `${jahr}-01-01`, `${jahr}-12-31`)])
    setKategorien(k); setSummen(s); setBuchungen(b)
  }, [jahr, kA])
  useEffect(() => { laden().catch((e) => setFehler(e.message)) }, [laden])

  const katVon = useMemo(() => new Map(kategorien.map((k) => [k.id, k])), [kategorien])
  const ue = useMemo(() => jahresuebersicht(summen), [summen])
  const liste = (buchungen ?? []).filter((b) => (!filter.monat || Number(b.datum.slice(5, 7)) === filter.monat) && (!filter.art || b.art === filter.art))

  async function speichern(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    const betrag = betragAusText(form.betrag)
    if (!betrag) { setFehler('Bitte einen gültigen Betrag eingeben, z. B. 90 oder 1.234,50.'); return }
    if (!form.kategorie_id) { setFehler('Bitte eine Kategorie wählen.'); return }
    if (form.dateien.some((d) => d.size > MAX_BELEG_BYTES)) { setFehler('Belege dürfen höchstens 10 MB groß sein.'); return }
    setArbeitet(true); setFehler('')
    try {
      const id = await buchungSpeichern(kA(), { art: form.art, datum: form.datum, betrag, kategorie_id: form.kategorie_id, zahlungsart: form.zahlungsart, beschreibung: form.beschreibung }, form.id)
      for (const d of form.dateien) await belegHochladen(kA(), id, d)
      await protokolliere(form.id ? 'buchung_geaendert' : 'buchung_angelegt')
      setForm(null); zeigeMeldung(`${FIN_ART[form.art]} vom ${datum(form.datum)} gespeichert.`); await laden()
    } catch (err) { setFehler((err as Error).message) } finally { setArbeitet(false) }
  }

  async function loeschen(b: Buchung) {
    if (!confirm(`${FIN_ART[b.art]} vom ${datum(b.datum)} über ${euro(b.betrag)} löschen?${b.belege.length ? ' Die Belege werden mitgelöscht.' : ''}`)) return
    try { await buchungLoeschen(b); await protokolliere('buchung_geloescht'); zeigeMeldung('Buchung gelöscht.'); await laden() } catch (err) { setFehler((err as Error).message) }
  }

  async function oeffneBeleg(x: BelegInfo) {
    try {
      const url = URL.createObjectURL(await belegOeffnen(kA(), x))
      const a = document.createElement('a'); a.href = url; a.download = x.name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (err) { setFehler(`Beleg konnte nicht geöffnet werden: ${(err as Error).message}`) }
  }

  async function entferneBeleg(x: BelegInfo) {
    if (!confirm(`Beleg „${x.name}“ löschen?`)) return
    try { await belegLoeschen(x); await laden(); setForm((f) => f && { ...f }) } catch (err) { setFehler((err as Error).message) }
  }

  function csv() {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`
    const zeilen = [...liste].reverse().map((b) => [datum(b.datum), FIN_ART[b.art], q(katVon.get(b.kategorie_id)?.name ?? ''), katVon.get(b.kategorie_id)?.e1a_kz ?? '', b.betrag.toFixed(2).replace('.', ','), ZAHLUNGSART[b.zahlungsart], q(b.beschreibung), b.belege.length].join(';'))
    const url = URL.createObjectURL(new Blob(['﻿' + ['Datum;Art;Kategorie;E1a-KZ;Betrag;Zahlungsart;Beschreibung;Belege', ...zeilen].join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `buchungen-${jahr}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const bearbeiten = (b: Buchung) => setForm({ id: b.id, art: b.art, datum: b.datum, betrag: b.betrag.toFixed(2).replace('.', ','), kategorie_id: b.kategorie_id, zahlungsart: b.zahlungsart, beschreibung: b.beschreibung, dateien: [] })
  const aktuelleBelege = form?.id ? (buchungen ?? []).find((b) => b.id === form.id)?.belege ?? [] : []

  return (
    <div className="space-y-6">
      <div className="nicht-drucken flex flex-wrap items-end justify-between gap-3">
        <div><p className="overline">Einnahmen-Ausgaben-Rechnung · Kleinunternehmerin (ohne USt)</p><h1 className="mt-2 font-heading text-heading">Finanzen</h1></div>
        <div className="flex flex-wrap items-end gap-2">
          <label>Jahr<select value={jahr} onChange={(e) => setJahr(Number(e.target.value))} className="mt-1 block rounded-md border border-border-input bg-surface px-3 py-2.5">
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + 1 - i).map((j) => <option key={j} value={j}>{j}</option>)}
          </select></label>
          <button className="btn btn-cta" onClick={() => { setForm(leer('einnahme')); setAnsicht('buchungen') }}>+ Einnahme</button>
          <button className="btn btn-primary" onClick={() => { setForm(leer('ausgabe')); setAnsicht('buchungen') }}>+ Ausgabe</button>
        </div>
      </div>

      <nav className="nicht-drucken flex gap-1 border-b border-border" aria-label="Finanzen">
        {([['uebersicht', 'Übersicht'], ['buchungen', 'Buchungen'], ['kategorien', 'Kategorien']] as [Ansicht, string][]).map(([k, t]) => (
          <button key={k} onClick={() => setAnsicht(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm ${ansicht === k ? 'border-accent-strong font-semibold text-heading' : 'border-transparent text-text-muted hover:text-heading'}`}>{t}</button>
        ))}
        <Link href="/finanzen/honorarnoten" className="-mb-px border-b-2 border-transparent px-4 py-2 text-sm text-text-muted no-underline hover:text-heading">Honorarnoten</Link>
      </nav>
      {fehler && <p className="fehler" role="alert">{fehler}</p>}

      {ansicht === 'uebersicht' && (
        <div className="space-y-6">
          <div className="nur-druck">
            <div className="flex items-start justify-between border-b border-border pb-2 text-xs text-text-muted"><span>{brand.appName}</span><img src="/brand/bildmarke.svg" alt="" width={36} height={27} /></div>
            <h1 className="mt-3 font-heading text-2xl text-heading">Einnahmen-Ausgaben-Rechnung {jahr}</h1>
            <p className="text-xs">Kleinunternehmerin, Beträge ohne Umsatzsteuer · Stand {datum(heute())}</p>
          </div>
          <div className="druck-summen grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[['Einnahmen', ue.einnahmen], ['Ausgaben', ue.ausgaben], ['Überschuss', ue.ueberschuss]].map(([t, w]) => (
              <div key={t as string} className="karte p-5"><span className="text-xs text-text-subtle">{t} {jahr}</span><b className="block font-heading text-3xl font-normal tabular-nums text-heading">{euro(w as number)}</b></div>
            ))}
          </div>
          <div className="karte overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-widest text-text-subtle"><th className="px-4 py-3 font-medium">Monat</th><th className="px-4 text-right font-medium">Einnahmen</th><th className="px-4 text-right font-medium">Ausgaben</th><th className="px-4 text-right font-medium">Überschuss</th></tr></thead>
              <tbody>{ue.monate.map((m) => (
                <tr key={m.monat} className="border-t border-border"><td className="px-4 py-2">{MONATE[m.monat - 1]}</td><td className="px-4 text-right tabular-nums">{euro(m.einnahmen)}</td><td className="px-4 text-right tabular-nums">{euro(m.ausgaben)}</td><td className={`px-4 text-right tabular-nums ${m.ueberschuss < 0 ? 'text-accent-strong' : ''}`}>{euro(m.ueberschuss)}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {(['einnahme', 'ausgabe'] as FinArt[]).map((art) => (
              <div key={art} className="karte p-0">
                <h2 className="px-4 pt-4 font-heading text-heading">{art === 'einnahme' ? 'Einnahmen' : 'Ausgaben'} nach Kategorie</h2>
                <table className="mt-2 w-full text-sm"><tbody>
                  {kategorien.filter((k) => k.art === art && ue.kategorien.get(k.id)).map((k) => (
                    <tr key={k.id} className="border-t border-border"><td className="px-4 py-2">{k.name}{k.e1a_kz && <span className="ml-2 text-xs text-text-subtle">KZ {k.e1a_kz}</span>}</td><td className="px-4 text-right tabular-nums">{euro(ue.kategorien.get(k.id) ?? 0)}</td></tr>
                  ))}
                </tbody></table>
                {!kategorien.some((k) => k.art === art && ue.kategorien.get(k.id)) && <p className="px-4 pb-4 text-sm text-text-muted">Noch keine Buchungen.</p>}
              </div>
            ))}
          </div>
          <div className="nicht-drucken flex gap-2"><button className="btn btn-ghost" onClick={() => print()}>Jahresübersicht drucken / PDF</button></div>
        </div>
      )}

      {ansicht === 'buchungen' && (
        <div className="space-y-5">
          {form && (
            <form onSubmit={speichern} className="karte grid gap-4 sm:grid-cols-3">
              <h2 className="font-heading text-heading sm:col-span-3">{form.id ? 'Buchung bearbeiten' : form.art === 'einnahme' ? 'Neue Einnahme' : 'Neue Ausgabe'}</h2>
              {!form.id && <label>Art<select value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value as FinArt, kategorie_id: '' })} className="mt-1 block w-full rounded-md border border-border-input bg-surface px-3 py-2.5"><option value="einnahme">Einnahme</option><option value="ausgabe">Ausgabe</option></select></label>}
              <label>Datum<input type="date" required value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} /></label>
              <label>Betrag (€)<input inputMode="decimal" required value={form.betrag} onChange={(e) => setForm({ ...form, betrag: e.target.value })} placeholder="z. B. 90,00" /></label>
              <label>Kategorie<select required value={form.kategorie_id} onChange={(e) => setForm({ ...form, kategorie_id: e.target.value })} className="mt-1 block w-full rounded-md border border-border-input bg-surface px-3 py-2.5">
                <option value="">Bitte wählen …</option>
                {kategorien.filter((k) => k.art === form.art && (k.aktiv || k.id === form.kategorie_id)).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select></label>
              <label>Zahlungsart<select value={form.zahlungsart} onChange={(e) => setForm({ ...form, zahlungsart: e.target.value as Zahlungsart })} className="mt-1 block w-full rounded-md border border-border-input bg-surface px-3 py-2.5">
                {Object.entries(ZAHLUNGSART).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select></label>
              <label className="sm:col-span-3">Beschreibung (verschlüsselt)<input value={form.beschreibung} onChange={(e) => setForm({ ...form, beschreibung: e.target.value })} placeholder={form.art === 'einnahme' ? 'z. B. Honorar K-26-0001-AB, Oktober' : 'z. B. Raummiete Oktober'} /></label>
              <div className="sm:col-span-3">
                <span className="block text-[13px] font-medium text-text-muted">Belege (PDF oder Foto, je höchstens 10 MB – werden verschlüsselt gespeichert)</span>
                {aktuelleBelege.map((x) => <div key={x.id} className="mt-1 flex items-center gap-2 text-sm"><button type="button" className="underline" onClick={() => void oeffneBeleg(x)}>{x.name}</button><button type="button" className="text-xs text-accent-strong" onClick={() => void entferneBeleg(x)}>entfernen</button></div>)}
                <input type="file" multiple accept="application/pdf,image/*" className="mt-2 block text-sm" onChange={(e) => setForm({ ...form, dateien: [...(e.target.files ?? [])] })} />
              </div>
              <div className="flex flex-wrap justify-end gap-2 sm:col-span-3">
                <button type="button" className="btn btn-ghost" onClick={() => { setForm(null); setFehler('') }}>Abbrechen</button>
                <button className="btn btn-cta" disabled={arbeitet}>{arbeitet ? 'Wird verschlüsselt und gespeichert …' : 'Speichern'}</button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label>Monat<select value={filter.monat} onChange={(e) => setFilter({ ...filter, monat: Number(e.target.value) })} className="mt-1 block rounded-md border border-border-input bg-surface px-3 py-2.5"><option value={0}>alle</option>{MONATE.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
            <label>Art<select value={filter.art} onChange={(e) => setFilter({ ...filter, art: e.target.value as '' | FinArt })} className="mt-1 block rounded-md border border-border-input bg-surface px-3 py-2.5"><option value="">alle</option><option value="einnahme">Einnahmen</option><option value="ausgabe">Ausgaben</option></select></label>
            <button className="btn btn-ghost" onClick={csv}>CSV für Steuerberatung</button>
          </div>

          <div className="karte overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-widest text-text-subtle">{['Datum', 'Art', 'Kategorie', 'Beschreibung', 'Betrag', 'Belege', ''].map((h, i) => <th key={i} className={`px-4 py-3 font-medium ${i === 4 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
              <tbody>{liste.map((b) => (
                <tr key={b.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums">{datum(b.datum)}</td>
                  <td className="px-4">{FIN_ART[b.art]}</td>
                  <td className="px-4">{katVon.get(b.kategorie_id)?.name}</td>
                  <td className="px-4 text-text-muted">{b.beschreibung}</td>
                  <td className={`whitespace-nowrap px-4 text-right tabular-nums ${b.art === 'ausgabe' ? 'text-accent-strong' : ''}`}>{b.art === 'ausgabe' ? '−' : ''}{euro(b.betrag)}</td>
                  <td className="px-4">{b.belege.map((x) => <button key={x.id} className="block text-left text-xs underline" onClick={() => void oeffneBeleg(x)}>{x.name}</button>)}</td>
                  <td className="whitespace-nowrap px-4"><button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => bearbeiten(b)}>Bearbeiten</button> <button className="btn btn-ghost px-3 py-1 text-xs text-accent-strong" onClick={() => void loeschen(b)}>Löschen</button></td>
                </tr>
              ))}</tbody>
            </table>
            {buchungen && liste.length === 0 && <p className="p-6 text-text-muted">Keine Buchungen in diesem Zeitraum.</p>}
            {!buchungen && !fehler && <p className="p-6 text-text-muted">Wird geladen und entschlüsselt …</p>}
          </div>
        </div>
      )}

      {ansicht === 'kategorien' && (
        <div className="space-y-5">
          <p className="max-w-2xl text-sm text-text-muted">Kategorien ordnen die Buchungen für die Einnahmen-Ausgaben-Rechnung. Die E1a-Kennzahl (Beilage zur Einkommensteuererklärung) am besten gemeinsam mit der Steuerberatung eintragen. Nicht mehr benötigte Kategorien ausblenden statt löschen.</p>
          <div className="karte flex flex-wrap items-end gap-3">
            <label className="min-w-64 flex-1">Neue Kategorie<input value={neueKat.name} onChange={(e) => setNeueKat({ ...neueKat, name: e.target.value })} /></label>
            <label>Art<select value={neueKat.art} onChange={(e) => setNeueKat({ ...neueKat, art: e.target.value as FinArt })} className="mt-1 block rounded-md border border-border-input bg-surface px-3 py-2.5"><option value="einnahme">Einnahme</option><option value="ausgabe">Ausgabe</option></select></label>
            <button className="btn btn-primary" onClick={async () => { if (!neueKat.name.trim()) return; try { await kategorieAnlegen(neueKat.name, neueKat.art); setNeueKat({ ...neueKat, name: '' }); await laden() } catch (e) { setFehler((e as Error).message) } }}>Anlegen</button>
          </div>
          {(['einnahme', 'ausgabe'] as FinArt[]).map((art) => (
            <div key={art} className="karte p-0">
              <h2 className="px-4 pt-4 font-heading text-heading">{art === 'einnahme' ? 'Einnahmen' : 'Ausgaben'}</h2>
              <table className="mt-2 w-full text-sm"><tbody>
                {kategorien.filter((k) => k.art === art).map((k) => (
                  <tr key={k.id} className={`border-t border-border ${k.aktiv ? '' : 'text-text-subtle'}`}>
                    <td className="px-4 py-2"><input aria-label="Name" defaultValue={k.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== k.name) void kategorieAendern(k.id, { name: v }).then(laden).catch((x) => setFehler(x.message)) }} /></td>
                    <td className="w-28 px-2"><input aria-label="E1a-Kennzahl" placeholder="KZ" defaultValue={k.e1a_kz ?? ''} maxLength={4} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (k.e1a_kz ?? '') && (v === '' || /^\d{4}$/.test(v))) void kategorieAendern(k.id, { e1a_kz: v || null }).then(laden).catch((x) => setFehler(x.message)) }} /></td>
                    <td className="whitespace-nowrap px-4"><button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => void kategorieAendern(k.id, { aktiv: !k.aktiv }).then(laden)}>{k.aktiv ? 'Ausblenden' : 'Einblenden'}</button></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
