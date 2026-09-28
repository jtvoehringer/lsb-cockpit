# Einrichtung und Betrieb (ICP)

## Supabase (Projekt `lsb-cockpit`, einmalig im Dashboard)
1. Authentication → Sign In / Providers → Email: **„Allow new users to sign up“ AUS** (Konten entstehen nur über `scripts/konto-anlegen.mjs`).
2. Authentication → Multi-Factor: **TOTP aktiviert** (Standard).
3. Authentication → Emails → „Reset password“: Vorlage auf einen Hinweis ohne Link ändern oder SMTP nicht konfigurieren – ein Zurücksetzen per E-Mail würde die Daten unlesbar machen und ist nicht vorgesehen.
4. Data API: „Automatically expose new tables“ bleibt AUS.

## Konto der Beraterin anlegen
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "<Dashboard → Project Settings → API Keys → secret>"
node scripts/konto-anlegen.mjs <email> "<Praxisname>"
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```
Den ausgegebenen **Einrichtungscode** persönlich übergeben. Melanie öffnet `/einrichten`, wählt die Passphrase, verbindet die Authenticator-App und druckt das Notfallblatt. Danach gilt der Einrichtungscode nicht mehr.

## Vercel
- Projekt `lsb-cockpit`, Branch `main` = Produktion (bis zur Umstellung: Diktat-Prototyp), Branch `cockpit` = Preview (Vercel-Authentifizierung).
- Umgebungsvariablen: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (öffentlich). **Kein** Service-Role-Schlüssel.
- Build: `npm run vercel-build` = Typprüfung + Krypto-Tests + Build.

## Vor dem Go-live
- Testkonto `test-beraterin@lsb-cockpit.invalid` und „Testpraxis“ löschen.
- Externe Prüfung Krypto-Kern und Kurz-Pentest (E-07).
- Wiederherstellung mit dem Notfallblatt einmal vollständig testen.
