'use client'
// Stammdaten und Einwilligungen einer Person (Zone A, K_A). Geöffnet aus dem Register – dort ist die Person bekannt.
import { useCallback, useEffect, useState } from 'react'
import { datum } from '@/lib/format'
import { protokolliere } from '@/lib/konto'
import { zeigeMeldung } from '@/lib/meldung'
import { aktualisiereRegister, type Akte, type RegisterInhalt } from '@/lib/protokolle/daten'
import {
  DATEI_MAX_MB, dokumentArtTitel, dokumentHochladen, dokumentLoeschen, dokumentOeffnen, EINWILLIGUNGEN, gueltigeEinwilligung, heuteIso, ladeDokumente, ladeStammdaten,
  leereStammdaten, pruefeStammdaten, setzeEinwilligungAkte, speichereStammdaten, type DokumentArt, type DokumentInfo, type EinwilligungsArt, type StammdatenInhalt,
} from '@/lib/stammdaten'
import { useTresor } from '@/lib/tresor'

type Zeile = RegisterInhalt & { id: string; akte?: Akte }
const ARTEN = Object.keys(EINWILLIGUNGEN) as EinwilligungsArt[]
const DOK_ARTEN: DokumentArt[] = ['unterlage', 'korrespondenz', ...ARTEN, 'sonstiges']
const groesse = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export function StammdatenPanel({ zeile, schliessen, gespeichert, zuDateien = false }: { zeile: Zeile; schliessen: () => void; gespeichert: () => Promise<void>; zuDateien?: boolean }) {
  const tresor = useTresor()
  const kA = useCallback(() => tresor.schluessel('zone_a'), [tresor])
  const [id, setId] = useState<string | null>(zeile.stammdaten_id ?? null)
  const [s, setS] = useState<StammdatenInhalt | null>(null)
  const [doks, setDoks] = useState<DokumentInfo[]>([])
  const [dokArt, setDokArt] = useState<DokumentArt>('unterlage')
  const [bezeichnung, setBezeichnung] = useState('')
  const [fehler, setFehler] = useState('')
  const [hinweis, setHinweis] = useState('')
  const [arbeitet, setArbeitet] = useState(false)
  // Aus dem Register über „Dateien“ geöffnet: nach dem Laden gleich zum Datei-Bereich
  useEffect(() => { if (zuDateien && s) document.getElementById('dateien')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [zuDateien, s])

  useEffect(() => {
    if (!zeile.stammdaten_id) { setS(leereStammdaten()); return }
    Promise.all([ladeStammdaten(kA(), zeile.stammdaten_id), ladeDokumente(kA(), zeile.stammdaten_id)])
      .then(([x, d]) => { setS(x); setDoks(d) })
      .catch((e) => setFehler(`Stammdaten konnten nicht geladen werden: ${e.message}`))
  }, [zeile.stammdaten_id, kA])

  /** Speichert Stammdaten, verknüpft sie verschlüsselt im Register und setzt das Einwilligungsdatum auf der Akte. */
  async function sichern(inhalt: StammdatenInhalt): Promise<string> {
    const neuId = await speichereStammdaten(kA(), id, inhalt)
    if (!id) {
      const { id: regId, akte_id, chiffre, name, vorname, nachname, adresse, kuerzel_alt, notiz } = zeile
      await aktualisiereRegister(tresor.schluessel('zone_c'), regId, { akte_id, chiffre, name, vorname, nachname, adresse, kuerzel_alt, notiz, stammdaten_id: neuId })
      setId(neuId)
    }
    await setzeEinwilligungAkte(zeile.akte_id, gueltigeEinwilligung(inhalt, 'datenschutz'))
    await protokolliere('stammdaten_geaendert', zeile.chiffre)
    return neuId
  }

  async function speichern() {
    if (!s) return
    const f = pruefeStammdaten(s)
    if (f.length) { setFehler(f.join(' ')); return }
    setFehler(''); setArbeitet(true)
    try { await sichern(s); await gespeichert(); zeigeMeldung(`Stammdaten ${zeile.chiffre} gespeichert.`); schliessen() }
    catch (e) { setFehler((e as Error).message) } finally { setArbeitet(false) }
  }

  async function hochladen(dateien: File[]) {
    if (!dateien.length || !s) return
    const zuGross = dateien.filter((d) => d.size > DATEI_MAX_MB * 1024 * 1024)
    if (zuGross.length) { setFehler(`Zu groß (höchstens ${DATEI_MAX_MB} MB je Datei): ${zuGross.map((d) => d.name).join(', ')}`); return }
    setFehler(''); setArbeitet(true)
    try {
      const sid = id ?? await sichern(s) // Dateien brauchen einen gespeicherten Stammdatensatz
      for (const d of dateien) await dokumentHochladen(kA(), sid, d, dokArt, bezeichnung.trim() || undefined)
      setDoks(await ladeDokumente(kA(), sid)); setBezeichnung('')
      await protokolliere('dokument_hochgeladen', `${zeile.chiffre} · ${dateien.length} Datei${dateien.length === 1 ? '' : 'en'}`)
      zeigeMeldung(`${dateien.length} Datei${dateien.length === 1 ? '' : 'en'} verschlüsselt hochgeladen (${zeile.chiffre}).`)
    } catch (e) { setFehler((e as Error).message) } finally { setArbeitet(false) }
  }

  async function oeffnen(d: DokumentInfo) {
    try {
      const url = URL.createObjectURL(await dokumentOeffnen(kA(), d))
      const a = document.createElement('a'); a.href = url; a.download = d.name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) { setFehler(`Dokument konnte nicht geöffnet werden: ${(e as Error).message}`) }
  }

  if (!s) return <div className="karte">{fehler ? <p className="fehler">{fehler}</p> : <p className="text-text-muted">Einen Moment …</p>}</div>
  const set = (teil: Partial<StammdatenInhalt>) => { setHinweis(''); setS({ ...s, ...teil }) }
  const setEw = (i: number, teil: Partial<StammdatenInhalt['einwilligungen'][number]>) => set({ einwilligungen: s.einwilligungen.map((e, j) => (j === i ? { ...e, ...teil } : e)) })
  const datenschutz = gueltigeEinwilligung(s, 'datenschutz')

  return (
    <div className="karte space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="overline">Stammdaten · Zone A</p>
          <h2 className="mt-1 font-heading text-heading">{zeile.name || 'Ohne Namen'} · <span className="tabular-nums">{zeile.chiffre}</span></h2>
        </div>
        <span className={datenschutz ? 'hinweis text-sm' : 'fehler text-sm'}>{datenschutz ? `Einwilligung Art. 9 seit ${datum(datenschutz)}` : 'Einwilligung Art. 9 fehlt'}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label>Geburtsjahr<input inputMode="numeric" maxLength={4} value={s.geburtsjahr ?? ''} onChange={(e) => set({ geburtsjahr: e.target.value })} autoComplete="off" /></label>
        <label>Telefon<input value={s.telefon ?? ''} onChange={(e) => set({ telefon: e.target.value })} autoComplete="off" /></label>
        <label>E-Mail<input type="email" value={s.email ?? ''} onChange={(e) => set({ email: e.target.value })} autoComplete="off" /></label>
        <label className="flex items-center gap-2 text-sm font-normal text-text sm:col-span-3"><input type="checkbox" checked={!!s.minderjaehrig} onChange={(e) => set({ minderjaehrig: e.target.checked })} /> minderjährig</label>
        {s.minderjaehrig && <label className="sm:col-span-3">Erziehungsberechtigte (Name, Kontakt)<input value={s.erziehungsberechtigte ?? ''} onChange={(e) => set({ erziehungsberechtigte: e.target.value })} autoComplete="off" /></label>}
        <label className="sm:col-span-3">Notfallkontakt (optional)<input value={s.notfallkontakt ?? ''} onChange={(e) => set({ notfallkontakt: e.target.value })} autoComplete="off" /></label>
        <label className="sm:col-span-3">Notiz<textarea rows={2} value={s.notiz ?? ''} onChange={(e) => set({ notiz: e.target.value })} className="mt-1 block w-full rounded-md border border-border-input bg-surface p-2" /></label>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading text-heading">Einwilligungen und Vereinbarungen</h3>
        {s.einwilligungen.length === 0 && <p className="text-sm text-text-muted">Noch nichts erfasst.</p>}
        {s.einwilligungen.map((e, i) => (
          <div key={e.id} className="grid gap-2 border-t border-border pt-2 sm:grid-cols-[2fr_1fr_1fr_2fr_auto] sm:items-end">
            <label>Art<select value={e.art} onChange={(x) => setEw(i, { art: x.target.value as EinwilligungsArt })} className="mt-1 block w-full rounded-md border border-border-input bg-surface px-3 py-2.5">
              {ARTEN.map((a) => <option key={a} value={a}>{EINWILLIGUNGEN[a].titel}</option>)}
            </select></label>
            <label>erteilt am<input type="date" value={e.erteilt_am} onChange={(x) => setEw(i, { erteilt_am: x.target.value })} /></label>
            <label>widerrufen am<input type="date" value={e.widerrufen_am ?? ''} onChange={(x) => setEw(i, { widerrufen_am: x.target.value || undefined })} /></label>
            <label>Notiz<input value={e.notiz ?? ''} onChange={(x) => setEw(i, { notiz: x.target.value })} placeholder={EINWILLIGUNGEN[e.art].hinweis} autoComplete="off" /></label>
            <button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={() => set({ einwilligungen: s.einwilligungen.filter((_, j) => j !== i) })}>Entfernen</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          {ARTEN.map((a) => (
            <button key={a} type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={() => set({ einwilligungen: [...s.einwilligungen, { id: crypto.randomUUID(), art: a, erteilt_am: heuteIso() }] })}>+ {EINWILLIGUNGEN[a].titel}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3" id="dateien">
        <h3 className="font-heading text-heading">Dateien{doks.length ? ` (${doks.length})` : ''}</h3>
        <p className="text-xs text-text-subtle">Unterschriebene Formulare, Befunde, Schreiben – als PDF oder Bild (Scan, Foto) bis {DATEI_MAX_MB} MB, auch mehrere auf einmal. Jede Datei wird auf diesem Gerät verschlüsselt, bevor sie hochgeladen wird.</p>
        {doks.length > 0 && (
          <ul className="divide-y divide-border text-sm">
            {doks.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 break-words"><b>{dokumentArtTitel(d.art)}</b>{d.bezeichnung && ` · ${d.bezeichnung}`} · {d.name} <span className="text-text-muted">· {groesse(d.groesse)} · {datum(d.erstellt_am)}</span></span>
                <span className="flex gap-2">
                  <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={() => void oeffnen(d)}>Öffnen</button>
                  <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={() => { if (confirm(`„${d.name}“ endgültig löschen?`)) void dokumentLoeschen(d).then(async () => { setDoks(await ladeDokumente(kA(), id!)); await protokolliere('dokument_geloescht', zeile.chiffre); zeigeMeldung(`„${d.name}“ gelöscht.`) }).catch((x) => setFehler(x.message)) }}>Löschen</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 rounded-md bg-background p-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <label>Art<select value={dokArt} onChange={(e) => setDokArt(e.target.value as DokumentArt)} className="mt-1 block w-full rounded-md border border-border-input bg-surface px-3 py-2.5 text-base">
            {DOK_ARTEN.map((a) => <option key={a} value={a}>{dokumentArtTitel(a)}</option>)}
          </select></label>
          <label>Bezeichnung (optional)<input value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} placeholder="z. B. Befund Hausärztin 03/2026" autoComplete="off" /></label>
          <label className={`btn btn-cta cursor-pointer ${arbeitet ? 'opacity-60' : ''}`}>{arbeitet ? 'Wird verschlüsselt …' : 'Dateien wählen und hochladen'}
            <input type="file" multiple accept="image/*,application/pdf" className="sr-only" disabled={arbeitet} onChange={(e) => { void hochladen(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          </label>
        </div>
      </div>

      {fehler && <p className="fehler" role="alert">{fehler}</p>}
      {hinweis && <p className="hinweis text-sm">{hinweis}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-cta" disabled={arbeitet} onClick={() => void speichern()}>{arbeitet ? 'Wird gespeichert …' : 'Stammdaten speichern'}</button>
        <button className="btn btn-ghost" onClick={schliessen}>Schließen</button>
      </div>
    </div>
  )
}
