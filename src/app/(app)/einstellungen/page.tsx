'use client'
import { useEffect, useState } from 'react'
import { ibanFormatiert, ibanGueltig, ladeEinstellungen, LEER, speichereEinstellungen, type PraxisEinstellungen } from '@/lib/einstellungen'
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
    </form>
  )
}
