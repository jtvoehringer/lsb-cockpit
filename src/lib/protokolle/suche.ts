// Volltextsuche in Protokollen – läuft nur im Browser auf bereits entschlüsselten Texten (nichts wird an den Server geschickt).
// Reine Funktionen, gut testbar.

/** Kleinbuchstaben, Akzente/Umlaut-Punkte weg („Gespräch“ findet auch „gesprach“), Leerraum zusammengefasst */
export function normalisiere(text: string): string {
  return text.toLocaleLowerCase('de').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
}

/** Suchbegriffe: Wörter, alle müssen vorkommen (UND). „in Anführungszeichen“ = zusammenhängender Ausdruck. */
export function begriffe(suche: string): string[] {
  const out: string[] = []
  for (const m of suche.matchAll(/"([^"]+)"|(\S+)/g)) {
    const b = normalisiere((m[1] ?? m[2]).trim())
    if (b) out.push(b)
  }
  return out
}

/** Trifft der Text alle Begriffe? (leere Suche = Treffer) */
export function trifft(text: string, b: string[]): boolean {
  if (!b.length) return true
  const t = normalisiere(text)
  return b.every((x) => t.includes(x))
}

/** Textausschnitt rund um den ersten Treffer: [davor, Treffer, danach] – für die Anzeige mit Hervorhebung */
export function ausschnitt(text: string, b: string[], umfeld = 60): [string, string, string] | null {
  const flach = text.replace(/\s+/g, ' ')
  const t = normalisiere(flach)
  // normalisiere ändert die Länge nicht (NFD-Zeichen werden wieder entfernt, Leerraum ist schon zusammengefasst)
  if (t.length !== flach.length) return null
  let pos = -1, laenge = 0
  for (const x of b) { const p = t.indexOf(x); if (p >= 0 && (pos < 0 || p < pos)) { pos = p; laenge = x.length } }
  if (pos < 0) return null
  const start = Math.max(0, pos - umfeld), ende = Math.min(flach.length, pos + laenge + umfeld)
  return [(start > 0 ? '… ' : '') + flach.slice(start, pos), flach.slice(pos, pos + laenge), flach.slice(pos + laenge, ende) + (ende < flach.length ? ' …' : '')]
}
