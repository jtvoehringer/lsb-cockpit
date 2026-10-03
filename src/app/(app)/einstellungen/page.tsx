'use client'
import { useEffect, useState } from 'react'
import { AUSDRUCK_LEER, ibanFormatiert, ibanGueltig, ladeAusdruck, ladeEinstellungen, ladeFristen, LEER, speichereAusdruck, speichereEinstellungen, speichereFristen, type PraxisEinstellungen, type ProtokollAusdruck } from '@/lib/einstellungen'
import { FRISTEN_STANDARD, pruefeFristEinstellungen, type FristEinstellungen } from '@/lib/fristen'
import { betragAusText, euro } from '@/lib/finanzen/modell'
import { protokolliere } from '@/lib/konto'

export default function Einstellungen() {
  const [e, setE] = useState<PraxisEinstellungen>(LEER)
  const [satz, setSatz] = useState('')
  const [stand, setStand] = useState('')
  const [fehler, setFehler] = useState('')

  useEffect(() => { ladeEinstellungen().then((x) => { setE(x); setSatz(x.honorarsatz ? String(x.honorarsatz).replace('.', ',') : '') }).catch((x) => setFehler(x.message)) }, [])

  async function speichern(ev: React.FormEvent) {
    ev.preventDefault(); setFehler(''); setStand('')
    const honorarsatz = satz.trim() ? betragAusText(satz) : 0
    if (honorarsatz === null) { setFehler('Honorarsatz bitte als Betrag eingeben, z. B. 90 oder 85,50.'); return }
    if (e.iban && !ibanGueltig(e.iban)) { setFehler('Die IBAN scheint nicht zu stimmen (Prüfziffer).'); return }
    try {
      await speichereEinstellungen({ ...e, honorarsatz, iban: e.iban ? ibanFormatiert(e.iban) : '' })
      await protokolliere('einstellungen_geaendert')
      setStand('Gespeichert.')
    } catch (x) { setFehler((x as Error).message) }
  }

  const feld = (k: keyof PraxisEinstellungen, titel: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{titel}<input value={String(e[k] ?? '')} onChange={(x) => setE({ ...e, [k]: k === 'zahlungsziel_tage' ? Number(x.target.value) || 0 : x.target.value })} {...extra} /></label>
  )

  return (
    <form onSubmit={speichern} className="max-w-3xl space-y-6">
      <div><p className="overline">Einstellungen</p><h1 className="mt-2 font-heading text-heading">Praxis und Honorarnoten</h1></div>
      <p className="text-sm text-text-muted">Diese Angaben erscheinen auf den Honorarnoten. Sie enthalten keine Klientendaten und werden deshalb unverschlüsselt gespeichert.</p>
      <div className="karte grid gap-4 sm:grid-cols-2">
        <h2 className="font-heading text-heading sm:col-span-2">Absender</h2>
        {feld('name', 'Name (wie auf der Honorarnote)', { placeholder: 'z. B. Melanie Vöhringer' })}
        {feld('berufsbezeichnung', 'Berufsbezeichnung')}
        {feld('strasse', 'Straße und Hausnummer')}
        {feld('plz_ort', 'PLZ und Ort')}
        {feld('telefon', 'Telefon')}
        {feld('email', 'E-Mail', { type: 'email' })}
      </div>
      <div className="karte grid gap-4 sm:grid-cols-2">
        <h2 className="font-heading text-heading sm:col-span-2">Bankverbindung</h2>
        {feld('iban', 'IBAN', { autoComplete: 'off' })}
        {feld('bic', 'BIC', { autoComplete: 'off' })}
        {feld('bank', 'Bank')}
      </div>
      <div className="karte grid gap-4 sm:grid-cols-2">
        <h2 className="font-heading text-heading sm:col-span-2">Honorar</h2>
        <label>Honorarsatz je Einheit (50 Min.) in €<input inputMode="decimal" value={satz} onChange={(x) => setSatz(x.target.value)} placeholder="z. B. 90,00" /></label>
        {feld('zahlungsziel_tage', 'Zahlungsziel (Tage)', { type: 'number', min: 0, max: 90 })}
        <label className="sm:col-span-2">Hinweis auf der Honorarnote<input value={e.hinweis} onChange={(x) => setE({ ...e, hinweis: x.target.value })} /></label>
        <p className="text-xs text-text-subtle sm:col-span-2">Beispiel: 1,8 Einheiten × {euro(betragAusText(satz) ?? 0)} = {euro(Math.round(1.8 * (betragAusText(satz) ?? 0) * 100) / 100)}. Der Kleinunternehmer-Hinweis ist voreingestellt – bitte mit der Steuerberatung bestätigen.</p>
      </div>
      {fehler && <p className="fehler" role="alert">{fehler}</p>}
      <div className="flex items-center gap-3"><button className="btn btn-cta">Speichern</button><span className="text-sm text-text-subtle" aria-live="polite">{stand}</span></div>
      <AusdruckEinstellungen />
      <FristenEinstellungen />
    </form>
  )
}

/** Aufbewahrungsfristen (eigener Speichern-Knopf). Wirken beim nächsten „Akte abschließen“; bestehende Fristen bleiben. */
function FristenEinstellungen() {
  const [f, setF] = useState<FristEinstellungen>(FRISTEN_STANDARD)
  const [stand, setStand] = useState('')
  const [fehler, setFehler] = useState('')
  useEffect(() => { ladeFristen().then(setF).catch((x) => setFehler(x.message)) }, [])

  async function speichern() {
    setStand(''); const p = pruefeFristEinstellungen(f)
    if (p.length) { setFehler(p.join(' ')); return }
    setFehler('')
    try { await speichereFristen(f); await protokolliere('fristen_geaendert', `${f.standard_jahre}/${f.zustimmung_jahre} J.`); setStand('Gespeichert.') } catch (x) { setFehler((x as Error).message) }
  }
  const zahlFeld = (k: 'standard_jahre' | 'zustimmung_jahre' | 'volljaehrig_mit', titel: string) => (
    <label>{titel}<input type="number" min={1} max={30} value={f[k]} onChange={(x) => setF({ ...f, [k]: Number(x.target.value) || 0 })} /></label>
  )

  return (
    <div className="karte grid gap-4 sm:grid-cols-3">
      <h2 className="font-heading text-heading sm:col-span-3">Aufbewahrungsfristen</h2>
      {zahlFeld('standard_jahre', 'Standard (Jahre nach Abschluss)')}
      {zahlFeld('zustimmung_jahre', 'Mit Zustimmung (Jahre)')}
      {zahlFeld('volljaehrig_mit', 'Volljährigkeit mit (Jahren)')}
      <label className="flex items-center gap-3 text-sm font-normal text-text sm:col-span-3"><input type="checkbox" checked={f.minderjaehrige_ab_volljaehrigkeit} onChange={(x) => setF({ ...f, minderjaehrige_ab_volljaehrigkeit: x.target.checked })} /> Bei Minderjährigen beginnt die Frist erst mit der Volljährigkeit</label>
      <p className="text-xs text-text-subtle sm:col-span-3">Voreingestellt laut Anforderungsaufnahme (3 / 7 Jahre, Minderjährige ab Volljährigkeit) – bitte rechtlich bestätigen lassen. Änderungen gelten für künftig abgeschlossene Akten; bereits berechnete Fristen bleiben.</p>
      {fehler && <p className="fehler sm:col-span-3" role="alert">{fehler}</p>}
      <div className="flex items-center gap-3 sm:col-span-3"><button type="button" className="btn btn-primary" onClick={() => void speichern()}>Fristen speichern</button><span className="text-sm text-text-subtle" aria-live="polite">{stand}</span></div>
    </div>
  )
}

/** Kopf des gedruckten Protokolls: Name der Beraterin, bei Protokollen „in Ausbildung“ zusätzlich das Ausbildungsinstitut */
function AusdruckEinstellungen() {
  const [a, setA] = useState<ProtokollAusdruck>(AUSDRUCK_LEER)
  const [stand, setStand] = useState('')
  const [fehler, setFehler] = useState('')
  useEffect(() => { ladeAusdruck().then(setA).catch((x) => setFehler(x.message)) }, [])

  async function speichern() {
    setStand(''); setFehler('')
    try { await speichereAusdruck({ beraterin: a.beraterin.trim(), institut: a.institut.trim() }); await protokolliere('einstellungen_geaendert', 'Protokoll-Ausdruck'); setStand('Gespeichert.') } catch (x) { setFehler((x as Error).message) }
  }

  return (
    <div className="karte grid gap-4 sm:grid-cols-2">
      <h2 className="font-heading text-heading sm:col-span-2">Protokoll-Ausdruck</h2>
      <label>Name der Beraterin<input value={a.beraterin} onChange={(x) => setA({ ...a, beraterin: x.target.value })} autoComplete="name" /></label>
      <label>Ausbildungsinstitut (mit Adresse)<input value={a.institut} onChange={(x) => setA({ ...a, institut: x.target.value })} placeholder="z. B. ROK Akademie (Trattnerhof 2, 1010 Wien)" /></label>
      <p className="text-xs text-text-subtle sm:col-span-2">Erscheint im gedruckten Protokoll unter dem Titel. Bei Protokollen mit Häkchen „in Ausbildung“: „LSB in Ausbildung: Name“ und „Ausbildungsinstitut: …“, sonst „Lebens- und Sozialberaterin: Name“.</p>
      {fehler && <p className="fehler sm:col-span-2" role="alert">{fehler}</p>}
      <div className="flex items-center gap-3 sm:col-span-2"><button type="button" className="btn btn-primary" onClick={() => void speichern()}>Ausdruck speichern</button><span className="text-sm text-text-subtle" aria-live="polite">{stand}</span></div>
    </div>
  )
}
