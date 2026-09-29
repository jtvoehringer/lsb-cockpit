# Go-live LSB Cockpit – Ablauf

Stand 29.09.2026. Ziel: lsb.icp-consultants.at zeigt das Cockpit; Melanie hat ihr Konto, ICP ein Support-Konto; keine Testdaten mehr.
Geplant **nach** der externen Prüfung (E-07, bis 30.10.2026) und spätestens zum Go-live 11.01.2027.

Rollen: **J** = Jörgen, **C** = Claude (nur nach ausdrücklichem „Go“ von J), **M** = Melanie.

## 0. Voraussetzungen
- [ ] E-07 abgeschlossen, Befunde erledigt (J)
- [ ] Praxisname für die Honorarnoten festgelegt (Firmenname; änderbar später unter „Einstellungen“) (J/M)
- [ ] Termin mit Melanie: Laptop (Chrome) **und** iPhone dabei, Drucker für das Notfallblatt, Handy mit Authenticator-App (J/M)

## 1. Supabase-Einstellungen prüfen (J, Dashboard)
- [ ] Authentication → Sign In / Providers → Email: „Allow new users to sign up“ **AUS**; Email OTP Expiration **600**, Length **8**
- [ ] Authentication → Emails → SMTP: Brevo aktiv (Absender noreply@icp-consultants.at); Vorlage „Magic Link“ mit `{{ .Token }}`
- [ ] Authentication → Emails → „Reset password“: Vorlage ohne Link (Zurücksetzen ist nicht vorgesehen)
- [ ] Authentication → URL Configuration: Site URL `https://lsb.icp-consultants.at`
- [ ] Brevo → Sicherheit → Zugelassene IPs: Sperre für **SMTP-Schlüssel AUS** (sonst kommen keine Codes)
- [ ] Data API: „Automatically expose new tables“ AUS

## 2. Testdaten löschen
1. [ ] (J) Supabase → Storage → Bucket `belege` → Ordner der Testpraxis löschen (1 verschlüsselter Testbeleg).
2. [ ] (C) Trockenlauf: `supabase/golive/1-testdaten-loeschen.sql` Teil A. Erwartet: 1 Testpraxis, 3 Konten @lsb-cockpit.invalid, „davon NICHT …“ = 0, Dateien im Bucket = 0.
3. [ ] (J) Freigabe „Testdaten löschen“ → (C) Teil B ausführen. Bricht selbst ab, wenn eine echte Praxis oder ein echtes Konto betroffen wäre. Probelauf am 29.09.2026 erfolgreich (zurückgerollt).
4. [ ] (C) Kontrolle: 0 Praxen, 0 Konten.

Das Chiffren-Präfix „T-“ entsteht nur in einer Praxis mit `einstellungen.test = true`; Melanies neue Praxis vergibt direkt `K-JJ-0001-XX`.

## 3. Cockpit auf die Produktionsadresse (C nach Freigabe, oder J)
Der Diktat-Prototyp auf `main` wurde nie genutzt und wird ersetzt; die Historie bleibt erhalten.
```powershell
cd C:\Users\joerg\Claude\Projects\LSB\cockpit
git fetch origin
git merge -s ours origin/main -m "Go-live: Cockpit ersetzt den Diktat-Prototyp auf main"
git push origin cockpit
git push origin cockpit:main
```
- [ ] Vercel: Produktions-Deployment von `main` ist READY (Build = Typprüfung + Krypto-Tests + Build)
- [ ] https://lsb.icp-consultants.at zeigt „Anmelden“; `/passkey-test.html` gibt es nicht mehr
- [ ] Sicherheits-Header vorhanden (CSP, HSTS) – `curl.exe -sI https://lsb.icp-consultants.at`
- [ ] Ordner `LSB\prototyp-diktat` (Worktree von `main`) nicht mehr verwenden, `push.ps1` dort nicht mehr ausführen

Rückweg: Vercel → Deployments → vorheriges Produktions-Deployment → „Instant Rollback“. Daten sind davon nicht betroffen.

## 4. Konten anlegen (J, lokal – Service-Role-Schlüssel nie in Vercel oder im Code)
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "<Dashboard → Project Settings → API Keys → secret>"
node scripts/konto-anlegen.mjs jv@icp-consultants.at "<Praxisname>" --support
node scripts/konto-anlegen.mjs m.voehringer@kabsi.at "<Praxisname>"
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```
Beide Male **denselben** Praxisnamen verwenden (sonst entstehen zwei Praxen). Die Einrichtungscodes notieren.

## 5. Probelauf mit dem Support-Konto (J) – prüft den ganzen Weg mit echter Post
- [ ] https://lsb.icp-consultants.at/einrichten → jv@icp-consultants.at + Einrichtungscode → Authenticator → landet in `/support` („keine Freigabe“)
- [ ] Abmelden → `/anmelden` → E-Mail-Code kommt an (Absender LSB Cockpit) → Authenticator → `/support`
- [ ] Alter Einrichtungscode funktioniert nicht mehr

## 6. Einrichtung mit Melanie (M, J daneben)
Am **Laptop** (Chrome):
- [ ] https://lsb.icp-consultants.at/einrichten → m.voehringer@kabsi.at + Einrichtungscode (persönlich übergeben)
- [ ] Authenticator-App verbinden (QR-Code), Code eingeben
- [ ] „Mit Windows Hello einrichten“ → bestätigen
- [ ] Notfallblatt drucken, Häkchen, „Einrichtung abschließen“ – Blatt versiegelt verwahren
- [ ] Schutz & Audit → „Handy per QR-Code hinzufügen“ → Windows Hello → QR mit iPhone-Kamera scannen → Face ID
- [ ] Sperren → „Entsperren mit Windows Hello“

Am **iPhone** (Safari oder Chrome):
- [ ] https://lsb.icp-consultants.at → E-Mail-Code → Authenticator → „Entsperren mit Face ID“

Gemeinsam:
- [ ] Wiederherstellung einmal testen: Sperren → „Mit Notfallblatt“ → Code vom Blatt
- [ ] Einstellungen: Absender, Bankverbindung, Honorarsatz
- [ ] Erstes Protokoll per Diktat (Mikrofon erlauben; Sprachmodell lädt einmalig ~250 MB)
- [ ] Optional: Support-Freigabe 1 Stunde → J prüft `/support` → Freigabe beenden

## 7. Nacharbeiten (J/C)
- [ ] `.env.test.local` löschen (Testzugänge sind ungültig); E2E-Tests überspringen sich ohne diese Werte
- [ ] Authenticator-Einträge „LSB Test“ / „LSB Einrichtungstest“ am Handy entfernen
- [ ] CLAUDE.md/SETUP.md: Stand „produktiv seit …“
