import brand from '@/config/brand.config'
import type { ProtokollAusdruck } from '@/lib/einstellungen'
import { datum, stunden, zahl, zeitpunkt } from '@/lib/format'
import type { Sitzung } from '@/lib/protokolle/daten'
import { ART, AUSBILDUNG_VERMERK, EINHEIT_MIN, einheiten, minuten, type Art, type Inhalt } from '@/lib/protokolle/modell'

type Kopf = Pick<Sitzung, 'datum' | 'beginn' | 'ende' | 'vorbereitung_min' | 'nachbereitung_min' | 'prozess_abgeschlossen' | 'in_ausbildung'>

/** Druckfassung eines Protokolls – im Editor (einzeln) und im Sammeldruck (/protokolle/druck) gleich. */
export function ProtokollDruck({ art, nr, chiffre, kopf, inhalt, entwurf, abgeschlossenAm, fassungen, ausdruck }: {
  art: Art; nr: number; chiffre: string; kopf: Kopf; inhalt: Inhalt; entwurf: boolean; abgeschlossenAm: string | null; fassungen: number; ausdruck: ProtokollAusdruck
}) {
  const a = ART[art]
  const m = minuten(kopf.beginn, kopf.ende)
  return (
    <>
      <div className="flex items-start justify-between border-b border-border pb-2 text-xs text-text-muted"><span>{brand.appName} · vertraulich (§ 119 GewO)</span><img src="/brand/bildmarke.svg" alt="" width={36} height={27} /></div>
      <h1 className="mt-3 font-heading text-2xl text-heading">{a.titel}</h1>
      {kopf.in_ausbildung && ausdruck.beraterin ? (
        <div className="mt-2 text-sm">
          <p><b>LSB in Ausbildung:</b> {ausdruck.beraterin}</p>
          {ausdruck.institut && <p>Ausbildungsinstitut: {ausdruck.institut}</p>}
        </div>
      ) : kopf.in_ausbildung ? <p className="mt-1 text-sm font-semibold">{AUSBILDUNG_VERMERK}</p>
        : ausdruck.beraterin && <p className="mt-2 text-sm"><b>Lebens- und Sozialberaterin:</b> {ausdruck.beraterin}</p>}
      <table className="druck-tabelle mt-3 w-full text-xs">
        <tbody>
          <tr><th>Protokoll-Nr.</th><th>Chiffre</th><th>Datum</th><th>Zeit (von–bis)</th><th>Dauer</th><th>Einheiten ({EINHEIT_MIN} Min.)</th></tr>
          <tr><td>{nr}</td><td>{chiffre}</td><td>{datum(kopf.datum)}</td><td>{kopf.beginn}–{kopf.ende}</td><td>{stunden(m)} h</td><td>{zahl(einheiten(m))}</td></tr>
          <tr><th>Vorbereitung</th><td>{stunden(kopf.vorbereitung_min)} h</td><th>Nachbereitung</th><td>{stunden(kopf.nachbereitung_min)} h</td><th>Prozess</th><td>{kopf.prozess_abgeschlossen ? 'abgeschlossen' : 'laufend'}</td></tr>
        </tbody>
      </table>
      {a.felder.map(([f, titel]) => <div key={f} className="mt-4 break-inside-avoid"><h3 className="text-sm font-semibold text-heading">{titel}</h3><p className="whitespace-pre-wrap text-sm">{inhalt.felder[f] || '–'}</p></div>)}
      {inhalt.supervision && <div className="mt-12 flex gap-10 text-xs text-text-muted"><div className="flex-1 border-t border-taupe pt-1">Datum, Unterschrift Beraterin</div><div className="flex-1 border-t border-taupe pt-1">Datum, Unterschrift und Stempel Supervision</div></div>}
      <p className="mt-6 text-xs text-text-subtle">{entwurf ? 'Entwurf' : `Abgeschlossen am ${zeitpunkt(abgeschlossenAm)}`}{fassungen > 1 ? ` · korrigiert (${fassungen} Fassungen)` : ''}</p>
    </>
  )
}
