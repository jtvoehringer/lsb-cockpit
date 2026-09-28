# Protokoll-Diktat (Prototyp, Stand 28.09.2026)

Eigenständige Seite zum Erfassen der Beratungsprotokolle per Sprache, bis das LSB Cockpit live ist. Kein Server für Daten, kein Konto.

- **Speicher:** nur im Browser auf dem jeweiligen Gerät (IndexedDB), jedes Protokoll mit AES-256-GCM verschlüsselt. Schlüssel aus der Passphrase (PBKDF2-SHA-256, 600.000 Iterationen). Nach 15 Minuten ohne Eingabe sperrt die Seite.
- **Spracherkennung:** Whisper (transformers.js 4.3.0) läuft lokal, auf dem Grafikchip (WebGPU) oder dem Prozessor. Aus dem Netz geladen werden nur Programm- und Modelldateien (Hugging Face, jsDelivr), nie Ton oder Text. Tonaufnahmen werden nicht gespeichert.
- **Protokolle:** Erstgespräch und Beratungsgespräch nach WKO-Gliederung; Dauer und Einheiten (50 Minuten) werden berechnet. Abgeschlossene Protokolle lassen sich nur als Korrektur ändern, die frühere Fassung bleibt als Version erhalten.
- **Ausgaben:** Protokoll als PDF (Drucken), Nachweisliste mit Summen (PDF, CSV – nur Kürzel), verschlüsselte Sicherung (JSON).
- **Übernahme ins Cockpit:** Beim Go-live liest das Cockpit die verschlüsselte Sicherung ein.

Wichtig:
- Jedes Gerät bzw. jeder Browser hat einen **eigenen** Speicher – es gibt keinen Abgleich. Ein Hauptgerät verwenden; Übertragen nur über „Sicherung einspielen“.
- Werden die Browserdaten gelöscht (oder das Gerät neu aufgesetzt), sind die Protokolle weg → regelmäßig „Sicherung speichern“, z. B. auf USB-Stick.
- Passphrase verloren = Protokolle verloren.

Lokal testen: `node serve.mjs` → http://localhost:4318 (Mikrofon und WebGPU funktionieren nur über https oder localhost).
Veröffentlichen: statisch (z. B. Vercel), Sicherheits-Header in `vercel.json`.
