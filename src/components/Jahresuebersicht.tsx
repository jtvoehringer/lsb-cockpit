import brand from '@/config/brand.config'
import { datum, heute } from '@/lib/format'
import type { Kategorie } from '@/lib/finanzen/daten'
import { euro, MONATE, type FinArt, type jahresuebersicht } from '@/lib/finanzen/modell'

/** Einnahmen-Ausgaben-Rechnung eines Jahres: Druckkopf, Summen, Monate, Kategorien – /finanzen und Druckvorschau. */
export function Jahresuebersicht({ jahr, ue, kategorien }: { jahr: number; ue: ReturnType<typeof jahresuebersicht>; kategorien: Kategorie[] }) {
  return (
    <>
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
            <h2 className="px-4 pt-4 font-heading text-heading print:text-base print:font-semibold">{art === 'einnahme' ? 'Einnahmen' : 'Ausgaben'} nach Kategorie</h2>
            <table className="mt-2 w-full text-sm"><tbody>
              {kategorien.filter((k) => k.art === art && ue.kategorien.get(k.id)).map((k) => (
                <tr key={k.id} className="border-t border-border"><td className="px-4 py-2">{k.name}{k.e1a_kz && <span className="ml-2 text-xs text-text-subtle">KZ {k.e1a_kz}</span>}</td><td className="px-4 text-right tabular-nums">{euro(ue.kategorien.get(k.id) ?? 0)}</td></tr>
              ))}
            </tbody></table>
            {!kategorien.some((k) => k.art === art && ue.kategorien.get(k.id)) && <p className="px-4 pb-4 text-sm text-text-muted">Noch keine Buchungen.</p>}
          </div>
        ))}
      </div>
    </>
  )
}
