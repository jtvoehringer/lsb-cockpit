'use client'
// Auskunft (Art. 15 DSGVO) und Datenübertragbarkeit (Art. 20) für eine Person – vollständig im Browser zusammengestellt.
import { ladeHonorarnoten } from './finanzen/honorarnoten'
import { ladeAkten, ladeInhalt, ladeRegister, ladeSitzungen, type RegisterInhalt } from './protokolle/daten'
import { ART, minuten, einheiten } from './protokolle/modell'
import { EINWILLIGUNGEN, ladeDokumente, ladeStammdaten, type StammdatenInhalt } from './stammdaten'

export type AuskunftSitzung = {
  nr: number; datum: string; art: string; beginn: string | null; ende: string | null; einheiten: number
  status: string; fassungen: number; abschnitte: { titel: string; text: string }[]
}
export type Auskunft = {
  erstellt_am: string
  chiffre: string
  person: Pick<RegisterInhalt, 'name' | 'adresse' | 'notiz'>
  stammdaten: Omit<StammdatenInhalt, 'einwilligungen'> | null
  einwilligungen: { art: string; erteilt_am: string; widerrufen_am?: string; notiz?: string }[]
  dokumente: { art: string; name: string; hochgeladen_am: string }[]
  sitzungen: AuskunftSitzung[]
  honorarnoten: { nummer: string; datum: string; betrag: number; status: string }[]
  aufbewahrung: { status: string; abschluss: string | null; bis: string | null }
}

export async function sammleAuskunft(k: { a: CryptoKey; b: CryptoKey; c: CryptoKey }, akteId: string): Promise<Auskunft> {
  const [akten, register, alleSitzungen, noten] = await Promise.all([ladeAkten(), ladeRegister(k.c), ladeSitzungen(), ladeHonorarnoten(k.a)])
  const akte = akten.find((a) => a.id === akteId)
  if (!akte) throw new Error('Akte nicht gefunden')
  const reg = register.find((r) => r.akte_id === akteId)
  const st = reg?.stammdaten_id ? await ladeStammdaten(k.a, reg.stammdaten_id) : null
  const doks = reg?.stammdaten_id ? await ladeDokumente(k.a, reg.stammdaten_id) : []

  const sitzungen: AuskunftSitzung[] = []
  for (const s of alleSitzungen.filter((x) => x.akte_id === akteId).sort((a, b) => a.datum.localeCompare(b.datum) || a.nr - b.nr)) {
    const { inhalt, versionen } = await ladeInhalt(k.b, s)
    sitzungen.push({
      nr: s.nr, datum: s.datum, art: ART[s.art].kurz, beginn: s.beginn, ende: s.ende, einheiten: einheiten(minuten(s.beginn, s.ende)),
      status: s.protokoll_status === 'abgeschlossen' ? 'abgeschlossen' : 'Entwurf', fassungen: versionen.length,
      abschnitte: ART[s.art].felder.map(([f, titel]) => ({ titel, text: inhalt.felder[f] ?? '' })).filter((a) => a.text.trim()),
    })
  }

  const { einwilligungen = [], ...stammRest } = st ?? { einwilligungen: [] }
  return {
    erstellt_am: new Date().toISOString(),
    chiffre: akte.chiffre,
    person: { name: reg?.name, adresse: reg?.adresse, notiz: reg?.notiz },
    stammdaten: st ? stammRest : null,
    einwilligungen: einwilligungen.map((e) => ({ art: EINWILLIGUNGEN[e.art]?.titel ?? e.art, erteilt_am: e.erteilt_am, widerrufen_am: e.widerrufen_am, notiz: e.notiz })),
    dokumente: doks.map((d) => ({ art: d.art === 'sonstiges' ? 'Sonstiges' : EINWILLIGUNGEN[d.art]?.titel ?? d.art, name: d.name, hochgeladen_am: d.erstellt_am })),
    sitzungen,
    honorarnoten: noten.filter((n) => n.akte_id === akteId).map((n) => ({ nummer: n.nummer, datum: n.datum, betrag: n.betrag, status: n.status })),
    aufbewahrung: { status: akte.status, abschluss: akte.abschluss_datum, bis: akte.aufbewahrung_bis },
  }
}
