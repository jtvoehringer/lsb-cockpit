'use client'
import { useState } from 'react'
import { SPERRE_NACH_MIN } from '@/lib/tresor'

// Häufige Fragen – Inhalte bewusst als Daten, damit sie leicht zu ergänzen sind.
type Frage = { f: string; a: string[] }
const BEREICHE: { titel: string; fragen: Frage[] }[] = [
  {
    titel: 'Anmeldung und Sicherheit',
    fragen: [
      { f: 'Wer kann meine Protokolle lesen?', a: ['Nur du. Alle Inhalte und Namen werden auf deinem Gerät verschlüsselt, bevor sie gespeichert werden. ICP, Supabase (Datenbank) und Vercel (Hosting) sehen ausschließlich unlesbaren Chiffretext.', 'Im Klartext gespeichert sind nur pseudonyme Eckdaten wie Chiffre, Datum, Uhrzeit und Einheiten – ohne Namen.'] },
      { f: 'Kann ich das Cockpit wie eine App installieren?', a: ['Ja. Laptop (Edge oder Chrome): in der Adressleiste auf das Symbol „App installieren“ klicken (oder Menü ⋯ → Apps → „LSB Cockpit installieren“). Danach startet das Cockpit in einem eigenen Fenster und liegt im Startmenü bzw. in der Taskleiste.', 'iPhone (Safari): Teilen-Symbol → „Zum Home-Bildschirm“. Das Cockpit erscheint als Symbol „Cockpit“ und öffnet ohne Browserleiste.', 'Es bleibt dieselbe Adresse mit denselben Passkeys – du meldest dich in der App einmal an wie gewohnt. Ohne Internet geht nichts: Das Cockpit lädt bewusst bei jedem Start den aktuellen, geprüften Stand vom Server und speichert nichts auf dem Gerät.'] },
      { f: 'Wie melde ich mich an?', a: ['E-Mail-Adresse eingeben, den Code aus der E-Mail eintippen (gilt 10 Minuten), dann den Code aus der Authenticator-App. Zum Schluss entsperrst du mit Windows Hello bzw. Face ID – oder mit der Passphrase.', 'Das ist nur auf einem neuen Gerät oder nach dem Abmelden nötig. Solange du angemeldet bleibst, genügt zum Weiterarbeiten das Entsperren.'] },
      { f: 'Warum drei Schritte?', a: ['Der E-Mail-Code zeigt, dass du Zugriff auf dein Postfach hast, der Code aus der App, dass du dein Handy hast. Erst dann gibt der Server die verschlüsselten Daten heraus.', 'Lesbar werden sie aber nur mit dem Schlüssel auf deinem Gerät (Windows Hello / Face ID) oder der Passphrase. Selbst wer dein E-Mail-Postfach und dein Handy hätte, könnte ohne diesen Schlüssel nichts lesen.'] },
      { f: 'Was bedeutet „Gesperrt“?', a: [`Nach ${SPERRE_NACH_MIN} Minuten ohne Eingabe, beim Neuladen der Seite oder über „Sperren“ werden die Schlüssel aus dem Arbeitsspeicher entfernt. Deine Anmeldung bleibt bestehen – zum Weiterarbeiten genügt Windows Hello bzw. Face ID (wenn eingerichtet) oder die Passphrase.`] },
      { f: 'Wie kommt ein weiteres Gerät dazu (z. B. das iPhone)?', a: ['Am Laptop unter „Schutz & Audit“ → „Handy per QR-Code hinzufügen“, mit Windows Hello bestätigen, dann den QR-Code mit der iPhone-Kamera scannen und dort mit Face ID bestätigen. Danach entsperrt das iPhone selbst.', 'Neuer Laptop: beim Entsperren im Fenster „anderes Gerät“ wählen und mit dem iPhone bestätigen, danach unter „Schutz & Audit“ → „Dieses Gerät einrichten“.', 'Jedes Gerät hat einen eigenen Schlüssel (Passkey), der es nie verlässt. Ein verlorenes Gerät bitte unter „Schutz & Audit“ entfernen.'] },
      { f: 'Ich habe meine Passphrase vergessen.', a: ['Ein Zurücksetzen per E-Mail gibt es bewusst nicht, sonst wären die Daten nicht wirklich geschützt. Der Weg zurück führt über das Notfallblatt mit dem Wiederherstellungscode – bitte gemeinsam mit ICP.', 'Ohne Passphrase und ohne Notfallblatt sind die Daten nicht wiederherstellbar – auch nicht durch ICP.'] },
      { f: 'Mein Handy mit der Authenticator-App ist weg.', a: ['Bitte ICP kontaktieren. Nach einer Identitätsprüfung wird der zweite Faktor zurückgesetzt; deine Daten bleiben dabei verschlüsselt, weil nur die Passphrase sie öffnet. Zusätzlich unter „Schutz & Audit“ → „Auf allen Geräten abmelden“.'] },
      { f: 'Wofür ist das Notfallblatt?', a: ['Es enthält den Wiederherstellungscode. Damit entsperrst du das Cockpit, wenn kein eingerichtetes Gerät mehr da ist (z. B. Laptop und Handy verloren) – beim Entsperren „Mit Notfallblatt“ wählen, danach das neue Gerät einrichten. Ausgedruckt, nicht digital, sicher verwahren – z. B. versiegelt bei einer Vertrauensperson oder im Safe.'] },
    ],
  },
  {
    titel: 'Protokolle',
    fragen: [
      { f: 'Erstgespräch oder Beratungsgespräch?', a: ['„Erstgespräch“ legt eine neue Akte mit neuer Chiffre an. Jedes weitere Gespräch ist ein „Beratungsgespräch“ zur bestehenden Chiffre – oben in der Protokoll-Liste die Chiffre wählen.', 'Alternativ im Register die Person anlegen und dort „Anlegen und Erstgespräch beginnen“ wählen.'] },
      { f: 'Wie trage ich Beratungen aus 2024 oder 2025 (Ausbildungszeit) nach?', a: ['In „Protokolle“ (oder im Register) zuerst das „Datum des Gesprächs“ wählen, dann „Erstgespräch“ anlegen – die Chiffre bekommt das Jahr dieses Datums (z. B. K-24-0001-AB). Weitere Gespräche zur selben Chiffre ebenso mit ihrem Datum anlegen. Möglich ab 2024. Hat eine Chiffre noch kein Gespräch (z. B. im Register nur angelegt), wird das erste Gespräch automatisch als Erstgespräch angelegt.', 'Häkchen „in Ausbildung“ setzen, wenn die Beratung im Rahmen der Ausbildung (vor der Gewerbeberechtigung) stattfand: Das Protokoll bekommt im Ausdruck einen Vermerk, und die Nachweisliste weist diese Gespräche mit „(A)“ aus und kann nach ihnen filtern – etwa als Praxisnachweis für die Gewerbeanmeldung. Das Häkchen lässt sich im Protokoll ändern, solange es ein Entwurf ist (sonst über „Korrigieren“).'] },
      { f: 'Was ist die Chiffre?', a: ['Eine automatisch vergebene Kennung wie K-26-0001-AB (Jahr, laufende Nummer, zwei Zufallsbuchstaben). Sie verrät nichts über die Person. Welche Person dahintersteht, steht nur verschlüsselt im Register.'] },
      { f: 'Entwurf, Abschließen, Korrigieren – was ist der Unterschied?', a: ['Ein Entwurf speichert sich automatisch. Mit „Protokoll abschließen“ wird er festgeschrieben.', 'Danach sind Änderungen nur über „Korrigieren“ möglich: Es entsteht eine neue Fassung, die bisherigen bleiben unverändert erhalten und lassen sich unter „Fassungen“ ansehen. So bleibt nachvollziehbar, was wann geändert wurde.'] },
      { f: 'Wie funktioniert das Diktieren?', a: ['Bei jedem Abschnitt auf „Diktieren“ tippen, sprechen, dann „Stopp“. Der Text wird angehängt – bitte kurz gegenlesen.', 'Die Spracherkennung läuft vollständig auf deinem Gerät. Ton und Text verlassen es nicht; die Aufnahme wird nicht gespeichert. Beim ersten Mal lädt der Browser einmalig das Sprachmodell (ca. 250 MB), danach geht es auch offline.', 'Der Browser fragt beim ersten Mal nach dem Mikrofon – bitte erlauben.'] },
      { f: 'Wie werden die Einheiten berechnet?', a: ['Aus Beginn und Ende: Dauer in Minuten geteilt durch 50. Beispiel: 17:00–18:30 = 90 Minuten = 1,8 Einheiten. Vor- und Nachbereitung werden getrennt ausgewiesen.'] },
      { f: 'Wie drucke ich ein Protokoll oder speichere es als PDF?', a: ['Im Protokoll „Drucken / PDF“ wählen und im Druckdialog „Als PDF speichern“. Auf Wunsch mit Unterschriftsfeld für die Supervision (Häkchen im Protokoll).', 'Erscheinen oben oder unten Adresse und Datum des Browsers: im Druckdialog unter „Weitere Einstellungen“ die „Kopf- und Fußzeilen“ abwählen.'] },
      { f: 'Was prüft „Auf Namen prüfen“?', a: ['Vor dem Abschließen durchsucht das Cockpit den Protokolltext nach Namen aus dem Register (aller Klientinnen und Klienten) und aus den Stammdaten, nach E-Mail-Adressen, Telefonnummern, Adressen, IBAN, langen Nummern und Geburtsdaten. Die Prüfung läuft nur auf deinem Gerät.', 'Findet sie etwas, siehst du die Stelle im Zusammenhang. Am besten umformulieren („die Schwester“ statt des Namens). Ist die Stelle unbedenklich (z. B. ein Allerweltswort, das zufällig auch ein Name ist), kannst du das bestätigen und trotzdem abschließen – im Ereignisprotokoll steht dann nur die Anzahl der Treffer, nie der Text.'] },
      { f: 'Kann ich ein Protokoll löschen?', a: ['Entwürfe ja („Entwurf löschen“). Abgeschlossene Protokolle nicht – sie sind Teil der Dokumentationspflicht. Fehler werden über „Korrigieren“ berichtigt.'] },
    ],
  },
  {
    titel: 'Register und Nachweis',
    fragen: [
      { f: 'Warum muss ich das Register noch einmal bestätigen?', a: ['Das Register verbindet Chiffren mit Namen und ist deshalb zusätzlich geschützt – mit Windows Hello / Face ID oder der Passphrase. Nach 5 Minuten ohne Eingabe sperrt es sich wieder. In den Protokoll-Listen erscheinen nie Namen.'] },
      { f: 'Wo erfasse ich Stammdaten und Einwilligungen?', a: ['Im Register bei der Person auf „Stammdaten“: Geburtsjahr, Telefon, E-Mail, bei Minderjährigen die Erziehungsberechtigten, dazu Beratungsvereinbarung, Einwilligung zur Verarbeitung der Gesundheitsdaten (Art. 9 DSGVO), Entbindung von der Verschwiegenheit und E-Mail-Erlaubnis – jeweils mit Datum und gegebenenfalls Widerruf.', 'Den unterschriebenen Zettel kannst du dort fotografieren oder als PDF hochladen; er wird vorher auf deinem Gerät verschlüsselt.', 'Solange die Einwilligung zur Verarbeitung der Gesundheitsdaten fehlt, zeigt die Protokoll-Liste bei der Chiffre „Einwilligung fehlt“. Nach einem Widerruf erscheint der Hinweis wieder.'] },
      { f: 'Wie lange werden Akten aufbewahrt, und wie lösche ich sie?', a: ['Unter „Fristen“ schließt du eine Akte ab, wenn die Beratung beendet ist. Das Cockpit berechnet dann, bis wann sie aufzubewahren ist: voreingestellt 3 Jahre nach Abschluss, 7 Jahre mit Zustimmung zur längeren Aufbewahrung (in den Stammdaten erfassen), bei Minderjährigen ab der Volljährigkeit. Die Werte kannst du unter „Einstellungen“ ändern.', 'Ist die Frist abgelaufen, erscheint die Akte unter „Zur Löschung fällig“ und auf der Übersicht. Zum Löschen die Chiffre eintippen und bestätigen: Protokolle, Stammdaten, Dokumente und Registereintrag werden endgültig gelöscht. Honorarnoten und Buchungen bleiben 7 Jahre (Buchhaltungspflicht). Im Löschprotokoll steht, wann was gelöscht wurde – ohne Namen und Inhalte.'] },
      { f: 'Welche Unterlagen gebe ich beim Erstgespräch mit?', a: ['Unter „Vorlagen“: die Information zum Datenschutz (zum Mitnehmen) und die Beratungsvereinbarung mit den Einwilligungen (unterschreiben lassen). Bei Bedarf die Entbindung von der Verschwiegenheit. Praxisangaben, Honorar und Aufbewahrungsfristen kommen automatisch aus den Einstellungen.', 'Danach im Register unter „Stammdaten“ die Einwilligungen mit Datum erfassen und das unterschriebene Blatt fotografieren oder als PDF hochladen.', 'Eine Teilnahmebestätigung (nur Termine und Einheiten, keine Inhalte) erstellst du im Register bei der Person über „Bestätigung“.'] },
      { f: 'Eine Klientin möchte Auskunft über ihre Daten – was tun?', a: ['Im Register bei der Person auf „Auskunft“: Das Cockpit stellt alles zusammen – Name und Kontakt, Einwilligungen, alle Gesprächsprotokolle, Honorarnoten, Aufbewahrung und die Rechte. Über „Drucken / PDF“ speichern oder ausdrucken; „JSON“ liefert dieselben Daten maschinenlesbar (Recht auf Datenübertragbarkeit).', 'Frist: ein Monat ab Eingang der Anfrage. Bitte persönlich oder über einen sicheren Weg übergeben, nicht unverschlüsselt per E-Mail.'] },
      { f: 'Wofür ist der verschlüsselte Gesamt-Export?', a: ['Unter „Schutz & Audit“ lädst du eine vollständige Kopie aller Daten herunter – unabhängig von ICP und den Anbietern. Die Datei ist verschlüsselt und lässt sich nur mit einem eingerichteten Gerät oder dem Notfallblatt öffnen.', 'Empfehlung: einmal im Monat auf einen eigenen, verschlüsselten Datenträger. Mit „Exportdatei prüfen“ siehst du, ob eine Sicherung vollständig lesbar ist.'] },
      { f: 'Wofür ist die Nachweisliste?', a: ['Sie zählt Protokolle, Einheiten, Stunden, Erstgespräche und abgeschlossene Prozesse – z. B. für den Befähigungsnachweis. Sie enthält nur Chiffren, keine Namen, und lässt sich als PDF drucken oder als CSV (Excel) speichern.'] },
    ],
  },
  {
    titel: 'Finanzen',
    fragen: [
      { f: 'Was kann der Bereich „Finanzen“?', a: ['Eine einfache Einnahmen-Ausgaben-Rechnung für Kleinunternehmerinnen (Beträge ohne Umsatzsteuer): Einnahmen und Ausgaben mit Kategorie erfassen, Belege anhängen, Monats- und Jahresübersicht, CSV für die Steuerberatung.'] },
      { f: 'Was ist dabei verschlüsselt?', a: ['Beschreibungen und Belege (Dateien samt Dateinamen) – dort können Namen von Klient:innen stehen. Betrag, Datum, Kategorie und Zahlungsart sind nicht verschlüsselt, damit die Summen berechnet werden können; sie enthalten keine Namen.', 'Tipp: In der Beschreibung von Honoraren die Chiffre statt des Namens verwenden.'] },
      { f: 'Wie stelle ich eine Honorarnote aus?', a: ['Finanzen → Honorarnoten → Chiffre wählen. Angeboten werden alle abgeschlossenen, noch nicht abgerechneten Gespräche; Betrag = Einheiten × Honorarsatz (Voreinstellung unter „Einstellungen“). Name und Adresse eintragen oder mit der Passphrase aus dem Register holen, dann „Honorarnote ausstellen“ und drucken bzw. als PDF speichern.', 'Die Einnahme wird gebucht, wenn das Geld da ist: sofort bei Barzahlung, sonst später mit „Als bezahlt“. Eine stornierte Honorarnote behält ihre Nummer.'] },
      { f: 'Was ist die E1a-Kennzahl bei den Kategorien?', a: ['Die Beilage E1a zur Einkommensteuererklärung fasst Einnahmen und Ausgaben in Kennzahlen zusammen. Die Zuordnung der Kategorien am besten einmal mit der Steuerberatung festlegen und unter „Kategorien“ eintragen – dann erscheint sie in der Übersicht und im CSV.'] },
    ],
  },
  {
    titel: 'Hilfe und Kontakt',
    fragen: [
      { f: 'Kann ICP auf meine Daten zugreifen?', a: ['Nein – nur wenn du es unter „Schutz & Audit“ → „Support-Freigabe“ ausdrücklich und befristet erlaubst (1 Stunde, 24 Stunden oder 7 Tage). Auch dann sieht der Support nur Einstellungen, Chiffren, Termine und das Ereignisprotokoll – keine Namen, keine Protokollinhalte, kein Register und keine Finanzen. Jeder Zugriff wird protokolliert; du kannst die Freigabe jederzeit beenden.'] },
      { f: 'Etwas funktioniert nicht – was tun?', a: ['Bitte ICP kontaktieren und beschreiben, was du gemacht hast und was angezeigt wurde. Bitte keine Protokollinhalte oder Namen mitschicken – ein Bildschirmfoto der Fehlermeldung genügt.', 'Unter „Schutz & Audit“ siehst du die installierte Version und die letzten Ereignisse.'] },
    ],
  },
]

export default function Hilfe() {
  const [suche, setSuche] = useState('')
  const q = suche.trim().toLowerCase()
  return (
    <div className="max-w-3xl space-y-6">
      <div><p className="overline">Hilfe</p><h1 className="mt-2 font-heading text-heading">Häufige Fragen</h1></div>
      <label className="max-w-sm">Suche<input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="z. B. Diktieren, Passphrase, PDF" /></label>
      {BEREICHE.map((b) => {
        const fragen = b.fragen.filter((x) => !q || (x.f + ' ' + x.a.join(' ')).toLowerCase().includes(q))
        if (!fragen.length) return null
        return (
          <section key={b.titel} className="space-y-2">
            <h2 className="font-heading text-heading">{b.titel}</h2>
            {fragen.map((x) => (
              <details key={x.f} className="karte p-0" open={!!q}>
                <summary className="cursor-pointer list-none px-5 py-4 font-medium text-heading">{x.f}</summary>
                <div className="space-y-2 px-5 pb-4 text-text-muted">{x.a.map((t) => <p key={t}>{t}</p>)}</div>
              </details>
            ))}
          </section>
        )
      })}
    </div>
  )
}
