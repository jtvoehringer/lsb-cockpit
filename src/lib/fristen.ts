// Aufbewahrungsfristen (R-09, F-08). Reine Berechnung – die Gründe (Minderjährigkeit, Zustimmung) stammen aus den
// verschlüsselten Stammdaten; gespeichert wird im Klartext nur das Ergebnis „aufbewahrung_bis“ auf der Akte.
// Standardwerte laut Anforderungsaufnahme v0.2 (rechtliche Bestätigung offen, O-03); änderbar unter „Einstellungen“.

export type FristEinstellungen = { standard_jahre: number; zustimmung_jahre: number; volljaehrig_mit: number; minderjaehrige_ab_volljaehrigkeit: boolean }
export const FRISTEN_STANDARD: FristEinstellungen = { standard_jahre: 3, zustimmung_jahre: 7, volljaehrig_mit: 18, minderjaehrige_ab_volljaehrigkeit: true }

export type FristGrundlage = { abschluss: string; minderjaehrig?: boolean; geburtsjahr?: string; zustimmung?: boolean }
export type FristErgebnis = { bis: string; beginn: string; jahre: number; grund: 'standard' | 'zustimmung'; ab_volljaehrigkeit: boolean }

const iso = (j: number, m: number, t: number) => `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`

/** Datum + Jahre; der 29. Februar wird in Nicht-Schaltjahren zum 28. Februar. */
export function plusJahre(datum: string, jahre: number): string {
  const [j, m, t] = datum.split('-').map(Number)
  const zj = j + jahre
  const schalt = (zj % 4 === 0 && zj % 100 !== 0) || zj % 400 === 0
  return iso(zj, m, m === 2 && t === 29 && !schalt ? 28 : t)
}

export function berechneAufbewahrung(g: FristGrundlage, e: FristEinstellungen = FRISTEN_STANDARD): FristErgebnis {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.abschluss)) throw new Error('Abschlussdatum fehlt.')
  let beginn = g.abschluss
  let ab_volljaehrigkeit = false
  if (g.minderjaehrig && e.minderjaehrige_ab_volljaehrigkeit) {
    if (!g.geburtsjahr || !/^\d{4}$/.test(g.geburtsjahr.trim())) throw new Error('Bei Minderjährigen wird das Geburtsjahr gebraucht (Stammdaten).')
    // Nur das Jahr ist bekannt – vorsichtig: Volljährigkeit spätestens am 31.12. dieses Jahres
    const volljaehrig = iso(Number(g.geburtsjahr) + e.volljaehrig_mit, 12, 31)
    if (volljaehrig > beginn) { beginn = volljaehrig; ab_volljaehrigkeit = true }
  }
  const grund = g.zustimmung ? 'zustimmung' : 'standard'
  const jahre = g.zustimmung ? e.zustimmung_jahre : e.standard_jahre
  return { bis: plusJahre(beginn, jahre), beginn, jahre, grund, ab_volljaehrigkeit }
}

export function pruefeFristEinstellungen(e: FristEinstellungen): string[] {
  const f: string[] = []
  if (!Number.isInteger(e.standard_jahre) || e.standard_jahre < 1 || e.standard_jahre > 30) f.push('Standardfrist bitte zwischen 1 und 30 Jahren.')
  if (!Number.isInteger(e.zustimmung_jahre) || e.zustimmung_jahre < e.standard_jahre || e.zustimmung_jahre > 30) f.push('Frist mit Zustimmung bitte mindestens so lang wie die Standardfrist (max. 30 Jahre).')
  if (!Number.isInteger(e.volljaehrig_mit) || e.volljaehrig_mit < 14 || e.volljaehrig_mit > 21) f.push('Volljährigkeitsalter bitte zwischen 14 und 21.')
  return f
}
