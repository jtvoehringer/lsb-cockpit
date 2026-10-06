import brand from '@/config/brand.config'
import { datum, heute, stunden, zahl } from '@/lib/format'
import type { Sitzung } from '@/lib/protokolle/daten'
import { ART, einheiten, minuten } from '@/lib/protokolle/modell'

/** Nachweisliste: Druckkopf, Summen, Tabelle, Unterschriften – Seite /nachweis und Druckvorschau. */
export function NachweisDruck({ zeilen, chiffreVon, von, bis, auswahl }: { zeilen: Sitzung[]; chiffreVon: Map<string, string>; von: string; bis: string; auswahl: string }) {
  const min = zeilen.reduce((x, s) => x + minuten(s.beginn, s.ende), 0)
  const vn = zeilen.reduce((x, s) => x + s.vorbereitung_min + s.nachbereitung_min, 0)
  const summen = [
    [String(zeilen.length), 'Protokolle'], [zahl(einheiten(min)), 'Einheiten (50 Min.)'], [stunden(min), 'Beratungsstunden'],
    [String(zeilen.filter((s) => s.art === 'erst').length), 'Erstgespräche'],
    [String(new Set(zeilen.filter((s) => s.prozess_abgeschlossen).map((s) => s.akte_id)).size), 'abgeschlossene Prozesse'],
    [String(new Set(zeilen.map((s) => s.akte_id)).size), 'Klient:innen (Chiffren)'], [stunden(vn), 'Vor-/Nachbereitung (Std.)'],
    [String(zeilen.filter((s) => s.in_ausbildung).length), 'davon in Ausbildung'],
  ]
  return (
    <>
      <div className="nur-druck">
        <div className="flex items-start justify-between border-b border-border pb-2 text-xs text-text-muted"><span>{brand.appName}</span><img src="/brand/bildmarke.svg" alt="" width={36} height={27} /></div>
        <h1 className="mt-3 font-heading text-2xl text-heading">Nachweisliste Beratungseinheiten</h1>
        <p className="text-xs">Zeitraum: {von ? datum(von) : 'Beginn'} bis {bis ? datum(bis) : datum(heute())} · {auswahl} · Einheit = 50 Minuten · nur Chiffren, keine Namen</p>
        {zeilen.some((s) => s.in_ausbildung) && <p className="text-xs">„(A)“ = Beratung im Rahmen der Ausbildung zur Lebens- und Sozialberaterin (vor Erteilung der Gewerbeberechtigung)</p>}
      </div>
      <div className="druck-summen grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {summen.map(([w, t]) => <div key={t} className="karte p-4"><b className="block font-heading text-2xl font-normal tabular-nums text-heading">{w}</b><span className="text-xs text-text-subtle">{t}</span></div>)}
      </div>
      <div className="karte overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-widest text-text-subtle">
            {['Nr.', 'Datum', 'Chiffre', 'Art', 'Dauer (Std.)', 'Einheiten', 'Vor-/Nachb. (Std.)'].map((h, i) => <th key={h} className={`whitespace-nowrap px-4 py-3 font-medium ${i >= 4 ? 'text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody>{zeilen.map((s) => { const m = minuten(s.beginn, s.ende); return (
            <tr key={s.id} className="border-t border-border"><td className="px-4 py-2 tabular-nums">{s.nr}</td><td className="px-4 tabular-nums">{datum(s.datum)}</td><td className="whitespace-nowrap px-4 tabular-nums">{chiffreVon.get(s.akte_id)}</td><td className="px-4">{ART[s.art].kurz}{s.in_ausbildung && <b title="in Ausbildung" className="ml-1">(A)</b>}</td>
              <td className="px-4 text-right tabular-nums">{stunden(m)}</td><td className="px-4 text-right tabular-nums">{zahl(einheiten(m))}</td><td className="px-4 text-right tabular-nums">{stunden(s.vorbereitung_min + s.nachbereitung_min)}</td></tr>) })}</tbody>
        </table>
      </div>
      <div className="nur-druck mt-12 flex gap-10 text-xs text-text-muted"><div className="flex-1 border-t border-taupe pt-1">Datum, Unterschrift Beraterin</div><div className="flex-1 border-t border-taupe pt-1">Bestätigung (optional)</div></div>
    </>
  )
}
