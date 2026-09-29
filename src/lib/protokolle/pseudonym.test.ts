import { describe, expect, it } from 'vitest'
import { namensTeile, pruefeText } from './pseudonym'

const arten = (t: ReturnType<typeof pruefeText>) => t.map((x) => `${x.art}:${x.text}`)

describe('Pseudonymisierungs-Check', () => {
  it('Namensteile: ohne Füllwörter, Klammern und Kurzformen', () => {
    expect(namensTeile(['Erika Testfrau (fiktiv)', 'Dr. Jo von Bergen-Au', null])).toEqual(['Testfrau', 'Bergen', 'Erika'])
  })

  it('findet Namen auch mit Genitiv-s und Umlaut, nicht als Wortteil', () => {
    const t = pruefeText({ verlauf: 'Erikas Mutter kam mit. Die Mühlbauerin sagte … Müller war nicht da. Erikanische Küche.' }, ['Erika Mühlbauer', 'Hans Müller'])
    expect(arten(t)).toEqual(['name:Erikas', 'name:Müller'])
  })

  it('Kontaktdaten, Adresse, IBAN, Geburtsdatum, SV-Nummer', () => {
    const t = pruefeText({
      anliegen: 'Erreichbar unter max@beispiel.invalid oder +43 664 123 45 67, wohnt Hauptstraße 12/3.',
      verlauf: 'Geboren am 3.4.1985; Termin am 12.10.2026. IBAN AT61 1904 3002 3457 3201, SV 1234 010185.',
    }, [], 2026)
    expect(arten(t)).toEqual([
      'email:max@beispiel.invalid', 'telefon:+43 664 123 45 67', 'adresse:Hauptstraße 12/3',
      'datum:3.4.1985', 'iban:AT61 1904 3002 3457 3201', 'nummer:1234 010185',
    ])
  })

  it('keine Fehlalarme bei Einheiten, Uhrzeiten, aktuellen Terminen und kurzen Zahlen', () => {
    expect(pruefeText({ verlauf: 'Von 17:00 bis 18:30, 1,8 Einheiten, nächster Termin 5.10.2026, Skala 7 von 10, 2 Kinder.' }, ['Anna Weiß'], 2026)).toEqual([])
  })

  it('Umfeld zeigt die Fundstelle mit etwas Text davor und danach', () => {
    const [t] = pruefeText({ ergebnis: 'Nach langem Gespräch meinte Weiß schließlich, sie wolle es versuchen.' }, ['Anna Weiß'])
    expect(t.umfeld).toContain('meinte Weiß schließlich')
  })
})
