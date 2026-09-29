'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { protokolliere } from '@/lib/konto'
import { ladeRegister, ladeSitzungen, neueAkte, neueSitzung, speichereEntwurf, versionAnhaengen } from '@/lib/protokolle/daten'
import type { Inhalt } from '@/lib/protokolle/modell'
import { ausBrowserSpeicher, ausSicherung, FalschePrototypPassphrase, oeffnePrototyp, plane, type PrototypProtokoll, type PrototypQuelle } from '@/lib/protokolle/prototyp'
import { useTresor } from '@/lib/tresor'

// Übernahme aus dem Diktat-Prototyp: Browser-Speicher (gleiche Adresse) oder Sicherungsdatei.
// Je altem Kürzel entsteht eine Akte mit neuer Chiffre; das alte Kürzel steht nur verschlüsselt im Register (Zone C).
export default function Uebernahme() {
  const tresor = useTresor()
  const [quelle, setQuelle] = useState<PrototypQuelle | null>(null)
  const [quellText, setQuellText] = useState('Suche im Browser-Speicher …')
  const [passphrase, setPassphrase] = useState('')
  const [protokolle, setProtokolle] = useState<PrototypProtokoll[] | null>(null)
  const [uebernommen, setUebernommen] = useState<Set<string>>(new Set())
  const [fortschritt, setFortschritt] = useState('')
  const [fertig, setFertig] = useState<string | null>(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    ausBrowserSpeicher().then((q) => {
      setQuelle(q)
      setQuellText(q ? `Im Browser gefunden: ${q.records.length} verschlüsselte Protokolle des Diktat-Prototyps.` : 'Im Browser dieses Geräts sind keine Prototyp-Protokolle gespeichert. Alternativ die Sicherungsdatei des Prototyps wählen.')
    }).catch(() => setQuellText('Browser-Speicher nicht lesbar – bitte die Sicherungsdatei wählen.'))
    ladeSitzungen().then((s) => setUebernommen(new Set(s.map((x) => x.herkunft).filter((h): h is string => !!h)))).catch(() => {})
  }, [])

  async function datei(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    try { const q = ausSicherung(JSON.parse(await f.text())); setQuelle(q); setQuellText(`Sicherungsdatei „${f.name}“: ${q.records.length} verschlüsselte Protokolle.`); setProtokolle(null) }
    catch (err) { setFehler((err as Error).message) }
  }

  async function oeffnen(e: React.FormEvent) {
    e.preventDefault(); setFehler('')
    try { setProtokolle(await oeffnePrototyp(quelle!, passphrase)); setPassphrase('') }
    catch (err) { setFehler(err instanceof FalschePrototypPassphrase ? err.message : `Nicht lesbar: ${(err as Error).message}`) }
  }

  async function uebernehmen() {
    if (!protokolle) return
    setFehler(''); setFertig(null)
    const plan = plane(protokolle, uebernommen)
    const kB = tresor.schluessel('zone_b'), kC = tresor.schluessel('zone_c')
    try {
      // Bereits zugeordnete Kürzel (frühere Übernahme) wiederverwenden
      const register = await ladeRegister(kC)
      const akteZu = new Map(register.filter((r) => r.kuerzel_alt).map((r) => [r.kuerzel_alt!, r.akte_id]))
      const belegteNr = new Set((await ladeSitzungen()).map((s) => s.nr))
      let naechste = Math.max(0, ...belegteNr) + 1
      let n = 0
      for (const p of plan.neu) {
        n++; setFortschritt(`Übernehme Protokoll ${n} von ${plan.neu.length} …`)
        const kuerzel = (p.kuerzel || '').trim() || '(ohne Kürzel)'
        let akteId = akteZu.get(kuerzel)
        if (!akteId) {
          const jahr = Number((protokolle.filter((x) => ((x.kuerzel || '').trim() || '(ohne Kürzel)') === kuerzel).map((x) => x.datum).sort()[0] ?? '').slice(0, 4)) || new Date().getFullYear()
          akteId = (await neueAkte(kC, { kuerzel_alt: kuerzel, notiz: 'aus Diktat-Prototyp übernommen' }, jahr)).id
          akteZu.set(kuerzel, akteId)
        }
        const nr = belegteNr.has(p.nr) ? naechste++ : p.nr
        belegteNr.add(nr); naechste = Math.max(naechste, nr + 1)
        const s = await neueSitzung(akteId, p.art, { nr, datum: p.datum, beginn: p.beginn || null, ende: p.ende || null, vorbereitung_min: p.vorbereitungMin ?? 0, nachbereitung_min: p.nachbereitungMin ?? 0, herkunft: p.id })
        const kopf = { datum: p.datum, beginn: p.beginn || null, ende: p.ende || null, vorbereitung_min: p.vorbereitungMin ?? 0, nachbereitung_min: p.nachbereitungMin ?? 0, prozess_abgeschlossen: !!p.prozessAbgeschlossen }
        const inhaltVon = (x: Omit<PrototypProtokoll, 'versionen'>): Inhalt => ({ felder: x.felder ?? {}, supervision: !!x.supervision })
        if (p.status !== 'abgeschlossen') {
          await speichereEntwurf(kB, s, kopf, inhaltVon(p))
        } else {
          const abgeschlossen_am = p.abgeschlossenAm ?? p.geaendertAm
          for (const alt of p.versionen ?? []) await versionAnhaengen(kB, s, kopf, inhaltVon(alt.fassung), { erstellt_am: alt.fassung.geaendertAm, abgeschlossen_am })
          await versionAnhaengen(kB, s, kopf, inhaltVon(p), { erstellt_am: p.geaendertAm, abgeschlossen_am })
        }
        setUebernommen((alt) => new Set(alt).add(p.id))
      }
      await protokolliere('uebernahme_prototyp', `${plan.neu.length} Protokolle`)
      setFertig(`${plan.neu.length} Protokolle übernommen${plan.uebersprungen ? `, ${plan.uebersprungen} waren schon übernommen` : ''}.`)
    } catch (err) { setFehler(`Abgebrochen: ${(err as Error).message}. Bereits Übernommenes bleibt erhalten; ein erneuter Start macht dort weiter.`) }
    finally { setFortschritt('') }
  }

  const plan = protokolle ? plane(protokolle, uebernommen) : null

  return (
    <div className="max-w-2xl space-y-6">
      <div><p className="overline">Übernahme</p><h1 className="mt-2 font-heading text-heading">Protokolle aus dem Diktat-Prototyp</h1></div>
      <div className="karte space-y-4">
        <p>{quellText}</p>
        <label className="btn btn-ghost relative cursor-pointer overflow-hidden">Sicherungsdatei wählen<input type="file" accept=".json,application/json" onChange={datei} className="absolute inset-0 opacity-0" /></label>
        {quelle && !protokolle && (
          <form onSubmit={oeffnen} className="space-y-3">
            <label>Passphrase des Diktat-Prototyps<input type="password" autoComplete="off" required value={passphrase} onChange={(e) => setPassphrase(e.target.value)} /></label>
            <button className="btn btn-primary">Protokolle öffnen</button>
          </form>
        )}
      </div>
      {fehler && <p className="fehler" role="alert">{fehler}</p>}
      {plan && (
        <div className="karte space-y-3">
          <p><b>{plan.neu.length}</b> Protokolle werden übernommen{plan.uebersprungen ? <>, <b>{plan.uebersprungen}</b> sind schon da</> : null}.</p>
          <p className="text-sm text-text-muted">Jedes alte Kürzel ({plan.kuerzel.length}) bekommt eine neue Chiffre. Das alte Kürzel wird nur verschlüsselt im Register vermerkt, damit bereits gedruckte Nachweise nachvollziehbar bleiben. Frühere Fassungen bleiben als Versionen erhalten.</p>
          {plan.neu.length > 0 && <button className="btn btn-cta" onClick={uebernehmen} disabled={!!fortschritt}>{fortschritt || 'Jetzt übernehmen'}</button>}
          {fertig && <p className="hinweis">{fertig} <Link href="/protokolle">Zu den Protokollen</Link></p>}
        </div>
      )}
    </div>
  )
}
