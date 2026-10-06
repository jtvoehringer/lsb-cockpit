import brand from '@/config/brand.config'
import type { ProtokollAusdruck } from '@/lib/einstellungen'
import { datum, heute, stunden, zahl } from '@/lib/format'
import type { Sitzung } from '@/lib/protokolle/daten'
import { ART, einheiten, minuten, type Inhalt } from '@/lib/protokolle/modell'

export type ZusammenfassungZeile = { s: Sitzung; chiffre: string; inhalt: Inhalt }

/** Thema für die Übersicht: erste Zeilen aus „Anliegen / Thema“, gekürzt */
export function thema(inhalt: Inhalt, max = 140): string {
  const t = (inhalt.felder.anliegen ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()} …` : t
}

/** Zusammenfassungsseite: je Protokoll Chiffre, Vor-/Nachbereitung, Beratungszeit, Thema – mit Summen. */
export function ZusammenfassungDruck({ zeilen, ausdruck }: { zeilen: ZusammenfassungZeile[]; ausdruck: ProtokollAusdruck }) {
  const summe = (f: (s: Sitzung) => number) => zeilen.reduce((x, z) => x + f(z.s), 0)
  const beratung = summe((s) => minuten(s.beginn, s.ende))
  const vor = summe((s) => s.vorbereitung_min), nach = summe((s) => s.nachbereitung_min)
  const daten = zeilen.map((z) => z.s.datum).sort()
  const alleAusbildung = zeilen.length > 0 && zeilen.every((z) => z.s.in_ausbildung)
  return (
    <>
      <div className="flex items-start justify-between border-b border-border pb-2 text-xs text-text-muted"><span>{brand.appName} · vertraulich (§ 119 GewO)</span><img src="/brand/bildmarke.svg" alt="" width={36} height={27} /></div>
      <h1 className="mt-3 font-heading text-2xl text-heading">Zusammenfassung Beratungsprotokolle</h1>
      {ausdruck.beraterin && (alleAusbildung
        ? <div className="mt-2 text-sm"><p><b>LSB in Ausbildung:</b> {ausdruck.beraterin}</p>{ausdruck.institut && <p>Ausbildungsinstitut: {ausdruck.institut}</p>}</div>
        : <p className="mt-2 text-sm"><b>Lebens- und Sozialberaterin:</b> {ausdruck.beraterin}</p>)}
      <p className="mt-1 text-xs text-text-muted">{zeilen.length} Protokolle · Zeitraum {daten.length ? `${datum(daten[0])} – ${datum(daten[daten.length - 1])}` : '–'} · Zeiten in Stunden · Einheit = 50 Minuten · nur Chiffren, keine Namen</p>
      <table className="druck-tabelle mt-3 w-full text-xs">
        <thead>
          <tr><th>Nr.</th><th>Datum</th><th>Chiffre</th><th>Art</th><th>Vorb.</th><th>Beratung</th><th>Nachb.</th><th>Einh.</th><th>Thema</th></tr>
        </thead>
        <tbody>
          {zeilen.map(({ s, chiffre, inhalt }) => {
            const m = minuten(s.beginn, s.ende)
            return (
              <tr key={s.id} className="break-inside-avoid">
                <td>{s.nr}</td><td className="whitespace-nowrap">{datum(s.datum)}</td><td className="whitespace-nowrap">{chiffre}</td>
                <td>{ART[s.art].kurz}{s.in_ausbildung && !alleAusbildung ? ' (A)' : ''}</td>
                <td>{stunden(s.vorbereitung_min)}</td><td>{m ? stunden(m) : '–'}</td><td>{stunden(s.nachbereitung_min)}</td><td>{m ? zahl(einheiten(m)) : '–'}</td>
                <td>{thema(inhalt) || '–'}</td>
              </tr>
            )
          })}
          <tr className="font-semibold">
            <td colSpan={4}>Summe</td><td>{stunden(vor)}</td><td>{stunden(beratung)}</td><td>{stunden(nach)}</td><td>{zahl(einheiten(beratung))}</td>
            <td>gesamt {stunden(vor + beratung + nach)} h</td>
          </tr>
        </tbody>
      </table>
      {zeilen.some((z) => z.s.in_ausbildung) && !alleAusbildung && <p className="mt-2 text-xs">(A) = Beratung im Rahmen der Ausbildung (vor Erteilung der Gewerbeberechtigung)</p>}
      <div className="mt-12 flex gap-10 text-xs text-text-muted"><div className="flex-1 border-t border-taupe pt-1">Datum, Unterschrift Beraterin</div><div className="flex-1 border-t border-taupe pt-1">Bestätigung (optional)</div></div>
      <p className="mt-4 text-xs text-text-subtle">Erstellt am {datum(heute())}</p>
    </>
  )
}
