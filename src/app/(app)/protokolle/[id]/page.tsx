'use client'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DiktatFeld } from '@/components/DiktatFeld'
import brand from '@/config/brand.config'
import { datum, stunden, zahl, zeitpunkt } from '@/lib/format'
import { protokolliere } from '@/lib/konto'
import {
  chiffreAnJahrAnpassen, entschluesseleVersion, entwurfLoeschen, ladeAkten, ladeInhalt, ladeRegister, ladeSitzung, speichereEntwurf, versionAnhaengen,
  type Sitzung, type Version,
} from '@/lib/protokolle/daten'
import { pruefeText, TREFFER_TITEL, type Treffer } from '@/lib/protokolle/pseudonym'
import { ladeStammdaten } from '@/lib/stammdaten'
import { ART, AUSBILDUNG_VERMERK, chiffreJahr, einheiten, leererInhalt, minuten, pruefeDatum, PROTOKOLL_AB_JAHR, type Feld, type Inhalt } from '@/lib/protokolle/modell'
import { useTresor } from '@/lib/tresor'

type Kopf = Pick<Sitzung, 'datum' | 'beginn' | 'ende' | 'vorbereitung_min' | 'nachbereitung_min' | 'prozess_abgeschlossen' | 'in_ausbildung'>

export default function ProtokollBearbeiten() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const tresor = useTresor()
  const [s, setS] = useState<Sitzung | null>(null)
  const [chiffre, setChiffre] = useState('')
  const [kopf, setKopf] = useState<Kopf | null>(null)
  const [inhalt, setInhalt] = useState<Inhalt>(leererInhalt())
  const [versionen, setVersionen] = useState<Version[]>([])
  const [korrektur, setKorrektur] = useState(false)
  const [aufnahme, setAufnahme] = useState(false)
  const [speicherStand, setSpeicherStand] = useState('')
  const [fehler, setFehler] = useState('')
  const [ansicht, setAnsicht] = useState<{ v: Version; inhalt: Inhalt } | null>(null)
  const [pruefung, setPruefung] = useState<{ treffer: Treffer[]; bestaetigt: boolean } | null>(null)
  const geaendert = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const laden = useCallback(async () => {
    const sitzung = await ladeSitzung(id)
    const [akten, r] = await Promise.all([ladeAkten(), ladeInhalt(tresor.schluessel('zone_b'), sitzung)])
    setS(sitzung); setChiffre(akten.find((a) => a.id === sitzung.akte_id)?.chiffre ?? '')
    setKopf({ datum: sitzung.datum, beginn: sitzung.beginn, ende: sitzung.ende, vorbereitung_min: sitzung.vorbereitung_min, nachbereitung_min: sitzung.nachbereitung_min, prozess_abgeschlossen: sitzung.prozess_abgeschlossen, in_ausbildung: sitzung.in_ausbildung })
    setInhalt(r.inhalt); setVersionen(r.versionen); setKorrektur(false); geaendert.current = false
  }, [id, tresor])

  useEffect(() => { laden().catch((e) => setFehler(e.message)) }, [laden])

  const entwurf = s?.protokoll_status === 'entwurf'
  const bearbeitbar = entwurf || korrektur

  /** Chiffre folgt strikt dem Jahr des Erstgesprächs (Datum 2024 → K-24-…) */
  const chiffreAbgleichen = useCallback(async (d: string) => {
    if (!s || s.art !== 'erst' || pruefeDatum(d) || chiffreJahr(chiffre) === Number(d.slice(0, 4))) return
    const w = await chiffreAnJahrAnpassen(tresor.schluessel('zone_c'), s.akte_id, Number(d.slice(0, 4)))
    if (w) { setChiffre(w.neu); await protokolliere('chiffre_geaendert', `${w.alt} → ${w.neu}`) }
  }, [s, chiffre, tresor])

  // Entwurf automatisch speichern (verschlüsselt); Korrekturen erst mit „Korrektur speichern“
  const speichern = useCallback(async () => {
    if (!s || !kopf || !entwurf || !geaendert.current) return
    geaendert.current = false
    try { await chiffreAbgleichen(kopf.datum); await speichereEntwurf(tresor.schluessel('zone_b'), s, kopf, inhalt); setSpeicherStand('gespeichert (verschlüsselt)') }
    catch (e) { setSpeicherStand(''); setFehler((e as Error).message) }
  }, [s, kopf, inhalt, entwurf, tresor, chiffreAbgleichen])

  useEffect(() => {
    if (!geaendert.current || !entwurf) return
    setSpeicherStand('…')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void speichern() }, 900)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [kopf, inhalt, entwurf, speichern])

  const aendereKopf = (k: Partial<Kopf>) => { geaendert.current = true; setKopf((alt) => ({ ...alt!, ...k })) }
  const aendereFeld = (f: Feld, t: string) => { geaendert.current = true; setInhalt((alt) => ({ ...alt, felder: { ...alt.felder, [f]: t } })) }

  /** Pseudonymisierungs-Check (F-15): Namen aus Register und Stammdaten dieser Akte, dazu Muster – alles lokal. */
  async function pruefen(): Promise<Treffer[]> {
    const register = await ladeRegister(tresor.schluessel('zone_c'))
    const namen: (string | undefined)[] = register.map((r) => r.name)
    const eigener = register.find((r) => r.akte_id === s!.akte_id)
    if (eigener?.stammdaten_id) {
      const st = await ladeStammdaten(tresor.schluessel('zone_a'), eigener.stammdaten_id).catch(() => null)
      if (st) namen.push(st.erziehungsberechtigte, st.notfallkontakt)
    }
    const felder = Object.fromEntries(ART[s!.art].felder.map(([f, titel]) => [titel, inhalt.felder[f]]))
    return pruefeText(felder, namen.filter((n): n is string => !!n))
  }

  async function abschliessen(geprueft = false) {
    if (!s || !kopf) return
    const fehlt = [!kopf.datum && 'Datum', !minuten(kopf.beginn, kopf.ende) && 'Beginn/Ende'].filter(Boolean)
    if (fehlt.length) { setFehler(`Bitte ausfüllen: ${fehlt.join(', ')}`); return }
    const datumFehler = pruefeDatum(kopf.datum)
    if (datumFehler) { setFehler(datumFehler); return }
    setFehler('')
    try {
      await chiffreAbgleichen(kopf.datum)
      if (!geprueft) {
        const t = await pruefen()
        if (t.length) { setPruefung({ treffer: t, bestaetigt: false }); return }
      }
      if (!korrektur && !confirm('Protokoll abschließen? Danach sind Änderungen nur noch als nachvollziehbare Korrektur möglich.')) return
      if (geprueft && pruefung) await protokolliere('pseudonym_bestaetigt', `Nr. ${s.nr}`, `${pruefung.treffer.length} Treffer`)
      await versionAnhaengen(tresor.schluessel('zone_b'), s, kopf, inhalt)
      await protokolliere(korrektur ? 'protokoll_korrigiert' : 'protokoll_abgeschlossen', `Nr. ${s.nr}`)
      setPruefung(null)
      await laden()
    } catch (e) { setFehler((e as Error).message) }
  }

  async function nurPruefen() {
    setFehler('')
    try {
      const t = await pruefen()
      setPruefung(t.length ? { treffer: t, bestaetigt: false } : null)
      if (!t.length) setSpeicherStand('Prüfung: keine Namen oder Kontaktdaten gefunden')
    } catch (e) { setFehler((e as Error).message) }
  }

  async function loeschen() {
    if (!s || !confirm('Diesen Entwurf endgültig löschen?')) return
    try { await entwurfLoeschen(s); router.replace('/protokolle') } catch (e) { setFehler((e as Error).message) }
  }

  async function zeigeVersion(v: Version) {
    setAnsicht({ v, inhalt: await entschluesseleVersion(tresor.schluessel('zone_b'), v) })
  }

  if (fehler && !s) return <p className="fehler">{fehler}</p>
  if (!s || !kopf) return <p className="text-text-muted">Wird geladen und entschlüsselt …</p>
  const art = ART[s.art]
  const m = minuten(kopf.beginn, kopf.ende)

  return (
    <>
      <div className="nicht-drucken space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="overline"><Link href="/protokolle" className="no-underline">Protokolle</Link> · {chiffre}</p>
            <h1 className="mt-2 font-heading text-heading">{art.titel} Nr. {s.nr}</h1>
            {kopf.in_ausbildung && <p className="mt-1 text-sm text-text-muted">{AUSBILDUNG_VERMERK}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-subtle" aria-live="polite">{entwurf ? speicherStand : ''}</span>
            <button className="btn btn-ghost" onClick={() => { if (korrektur && geaendert.current && !confirm('Korrektur nicht gespeichert – verwerfen?')) return; void speichern().then(() => router.push('/protokolle')) }}>← Zurück zur Liste</button>
            <button className="btn btn-ghost" onClick={() => { void speichern().then(() => print()) }}>Drucken / PDF</button>
          </div>
        </div>

        {!entwurf && (
          <div className="hinweis">
            {korrektur ? 'Korrektur: Beim Speichern entsteht eine neue Fassung; die bisherigen bleiben erhalten.'
              : `Abgeschlossen am ${zeitpunkt(s.abgeschlossen_am)}${versionen.length > 1 ? ` · ${versionen.length} Fassungen` : ''}. Änderungen nur über „Korrigieren“.`}
          </div>
        )}
        {fehler && <p className="fehler" role="alert">{fehler}</p>}

        <div className="karte grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Anzeige titel="Chiffre" wert={chiffre} />
          <label>Datum<input type="date" min={`${PROTOKOLL_AB_JAHR}-01-01`} value={kopf.datum} disabled={!bearbeitbar} onChange={(e) => aendereKopf({ datum: e.target.value })} /></label>
          <label>Beginn<input type="time" value={kopf.beginn ?? ''} disabled={!bearbeitbar} onChange={(e) => aendereKopf({ beginn: e.target.value || null })} /></label>
          <label>Ende<input type="time" value={kopf.ende ?? ''} disabled={!bearbeitbar} onChange={(e) => aendereKopf({ ende: e.target.value || null })} /></label>
          <label>Vorbereitung (Min.)<input type="number" min={0} step={5} value={kopf.vorbereitung_min} disabled={!bearbeitbar} onChange={(e) => aendereKopf({ vorbereitung_min: Number(e.target.value) || 0 })} /></label>
          <label>Nachbereitung (Min.)<input type="number" min={0} step={5} value={kopf.nachbereitung_min} disabled={!bearbeitbar} onChange={(e) => aendereKopf({ nachbereitung_min: Number(e.target.value) || 0 })} /></label>
          <Anzeige titel="Dauer / Einheiten (50 Min.)" wert={m ? `${stunden(m)} h · ${zahl(einheiten(m))} E` : '–'} />
        </div>

        {art.felder.map(([f, titel]) => (
          <DiktatFeld key={f} id={f} titel={titel} wert={inhalt.felder[f] ?? ''} gesperrt={!bearbeitbar}
            aufAenderung={(t) => aendereFeld(f, t)} aufnahmeLaeuft={aufnahme} setzeAufnahme={setAufnahme} />
        ))}

        <div className="space-y-2 pt-2">
          <label className="flex items-center gap-3 text-sm font-normal text-text"><input type="checkbox" checked={kopf.prozess_abgeschlossen} disabled={!bearbeitbar} onChange={(e) => aendereKopf({ prozess_abgeschlossen: e.target.checked })} /> Beratungsprozess mit diesem Gespräch abgeschlossen</label>
          <label className="flex items-center gap-3 text-sm font-normal text-text"><input type="checkbox" checked={kopf.in_ausbildung} disabled={!bearbeitbar} onChange={(e) => aendereKopf({ in_ausbildung: e.target.checked })} /> In Ausbildung (Vermerk im Ausdruck und in der Nachweisliste)</label>
          <label className="flex items-center gap-3 text-sm font-normal text-text"><input type="checkbox" checked={inhalt.supervision} disabled={!bearbeitbar} onChange={(e) => { geaendert.current = true; setInhalt({ ...inhalt, supervision: e.target.checked }) }} /> Unterschriftsfeld für Supervision im Ausdruck</label>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-4">
          {entwurf && <button className="btn btn-ghost text-accent-strong" onClick={loeschen}>Löschen</button>}
          {entwurf && <button className="btn btn-primary" onClick={() => { geaendert.current = true; void speichern().then(() => setSpeicherStand('gespeichert (verschlüsselt)')) }} disabled={aufnahme}>Speichern</button>}
          {!entwurf && !korrektur && <button className="btn btn-ghost" onClick={() => setKorrektur(true)}>Korrigieren</button>}
          {korrektur && <button className="btn btn-ghost" onClick={() => { if (confirm('Korrektur verwerfen?')) void laden() }}>Verwerfen</button>}
          {bearbeitbar && <button className="btn btn-ghost" onClick={() => void nurPruefen()} disabled={aufnahme}>Auf Namen prüfen</button>}
          {bearbeitbar && <button className="btn btn-cta" onClick={() => void abschliessen()} disabled={aufnahme}>{korrektur ? 'Korrektur speichern' : 'Protokoll abschließen'}</button>}
        </div>

        {entwurf && <p className="text-right text-xs text-text-subtle">Entwürfe speichern sich auch automatisch. „Löschen“ entfernt den Entwurf endgültig.</p>}
        {!entwurf && !korrektur && <p className="text-right text-xs text-text-subtle">Abgeschlossene Protokolle lassen sich nicht löschen (Aufbewahrungspflicht) – nur korrigieren. Die ganze Akte wird nach Ablauf der Frist unter „Fristen“ gelöscht.</p>}

        {pruefung && (
          <div className="karte space-y-3 border-2 border-accent-strong" role="alertdialog" aria-label="Pseudonymisierungs-Check">
            <h2 className="font-heading text-heading">Bitte prüfen: {pruefung.treffer.length === 1 ? '1 möglicher Personenbezug' : `${pruefung.treffer.length} mögliche Personenbezüge`}</h2>
            <p className="text-sm text-text-muted">Protokolle sollen niemanden identifizierbar machen. Bitte die Stellen umformulieren (z. B. „die Mutter“ statt des Namens) – oder bestätigen, dass sie unbedenklich sind.</p>
            <ul className="divide-y divide-border text-sm">
              {pruefung.treffer.map((t, i) => (
                <li key={i} className="py-2">
                  <b>{TREFFER_TITEL[t.art]}</b> <span className="text-text-muted">· {t.feld}</span>
                  <div className="mt-1">{t.umfeld.split(t.text).map((teil, j, alle) => <span key={j}>{teil}{j < alle.length - 1 && <mark className="rounded bg-sand px-1 font-medium">{t.text}</mark>}</span>)}</div>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-3 text-sm font-normal text-text"><input type="checkbox" className="mt-0.5" checked={pruefung.bestaetigt} onChange={(e) => setPruefung({ ...pruefung, bestaetigt: e.target.checked })} /> Ich habe die Stellen geprüft – sie machen niemanden identifizierbar.</label>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => setPruefung(null)}>Zurück zum Text</button>
              <button className="btn btn-ghost" disabled={!pruefung.bestaetigt} onClick={() => void abschliessen(true)}>{korrektur ? 'Trotzdem Korrektur speichern' : 'Trotzdem abschließen'}</button>
            </div>
          </div>
        )}

        {versionen.length > 0 && (
          <div className="karte">
            <h2 className="font-heading text-heading">Fassungen</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {versionen.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3">
                  <span className="tabular-nums">Fassung {v.version} · {zeitpunkt(v.erstellt_am)}</span>
                  <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => void zeigeVersion(v)}>Ansehen</button>
                </li>
              ))}
            </ul>
            {ansicht && (
              <div className="mt-4 rounded-md bg-background p-4 text-sm">
                <p className="overline">Fassung {ansicht.v.version} (nur lesen)</p>
                {art.felder.map(([f, titel]) => <div key={f} className="mt-2"><b>{titel}</b><p className="whitespace-pre-wrap">{ansicht.inhalt.felder[f] || '–'}</p></div>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Druckfassung */}
      <div className="nur-druck">
        <div className="flex items-start justify-between border-b border-border pb-2 text-xs text-text-muted"><span>{brand.appName} · vertraulich (§ 119 GewO)</span><img src="/brand/bildmarke.svg" alt="" width={36} height={27} /></div>
        <h1 className="mt-3 font-heading text-2xl text-heading">{art.titel}</h1>
        {kopf.in_ausbildung && <p className="mt-1 text-sm font-semibold">{AUSBILDUNG_VERMERK}</p>}
        <table className="druck-tabelle mt-3 w-full text-xs">
          <tbody>
            <tr><th>Protokoll-Nr.</th><th>Chiffre</th><th>Datum</th><th>Zeit (von–bis)</th><th>Dauer</th><th>Einheiten (50 Min.)</th></tr>
            <tr><td>{s.nr}</td><td>{chiffre}</td><td>{datum(kopf.datum)}</td><td>{kopf.beginn}–{kopf.ende}</td><td>{stunden(m)} h</td><td>{zahl(einheiten(m))}</td></tr>
            <tr><th>Vorbereitung</th><td>{stunden(kopf.vorbereitung_min)} h</td><th>Nachbereitung</th><td>{stunden(kopf.nachbereitung_min)} h</td><th>Prozess</th><td>{kopf.prozess_abgeschlossen ? 'abgeschlossen' : 'laufend'}</td></tr>
          </tbody>
        </table>
        {art.felder.map(([f, titel]) => <div key={f} className="mt-4 break-inside-avoid"><h3 className="text-sm font-semibold text-heading">{titel}</h3><p className="whitespace-pre-wrap text-sm">{inhalt.felder[f] || '–'}</p></div>)}
        {inhalt.supervision && <div className="mt-12 flex gap-10 text-xs text-text-muted"><div className="flex-1 border-t border-taupe pt-1">Datum, Unterschrift Beraterin</div><div className="flex-1 border-t border-taupe pt-1">Datum, Unterschrift und Stempel Supervision</div></div>}
        <p className="mt-6 text-xs text-text-subtle">{entwurf ? 'Entwurf' : `Abgeschlossen am ${zeitpunkt(s.abgeschlossen_am)}`}{versionen.length > 1 ? ` · korrigiert (${versionen.length} Fassungen)` : ''}</p>
      </div>
    </>
  )
}

function Anzeige({ titel, wert }: { titel: string; wert: string }) {
  return <div><span className="block text-[13px] font-medium text-text-muted">{titel}</span><span className="mt-2 block text-base font-semibold tabular-nums">{wert}</span></div>
}
