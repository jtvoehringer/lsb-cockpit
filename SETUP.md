# Einrichtung und Betrieb (ICP)

## Supabase (Projekt `lsb-cockpit`, einmalig im Dashboard)
1. Authentication → Sign In / Providers → Email: **„Allow new users to sign up“ AUS** (Konten entstehen nur über `scripts/konto-anlegen.mjs`). Email OTP Expiration 600 s, Length 8.
2. Authentication → Multi-Factor: **TOTP aktiviert** (Standard).
3. Authentication → Emails: SMTP über Brevo (`docs/Brevo-SMTP-Supabase.md`), Vorlage „Magic Link“ mit Code `{{ .Token }}`. „Reset password“ ohne Link – ein Zurücksetzen per E-Mail ist nicht vorgesehen.
4. Brevo → Sicherheit → Zugelassene IPs: Sperre für SMTP-Schlüssel **AUS** (Supabase sendet von wechselnden Adressen).
5. Data API: „Automatically expose new tables“ bleibt AUS.

## Konto anlegen
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "<Dashboard → Project Settings → API Keys → secret>"
node scripts/konto-anlegen.mjs <email> "<Praxisname>"            # Beraterin
node scripts/konto-anlegen.mjs <email> "<Praxisname>" --support  # ICP-Support (technisch, ohne Inhalte)
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```
Den ausgegebenen **Einrichtungscode** persönlich übergeben. `/einrichten`: E-Mail + Einrichtungscode → Authenticator-App → Windows Hello / Face ID (Passphrase nur als Ausweichweg) → Notfallblatt. Danach gilt der Einrichtungscode nicht mehr; angemeldet wird per E-Mail-Code + Authenticator.

## Vercel
- Projekt `lsb-cockpit`, Branch `main` = Produktion, Branch `cockpit` = Preview (Vercel-Authentifizierung).
- Öffentliche Werte in `.env.production` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). **Kein** Service-Role-Schlüssel.
- Build: `npm run vercel-build` = Typprüfung + Krypto-Tests + Build.

## Go-live
Siehe `docs/Go-live.md` (Testdaten löschen mit `supabase/golive/1-testdaten-loeschen.sql`, Umstellung `main`, Konten, Einrichtung mit Melanie).
