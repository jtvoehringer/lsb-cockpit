# Brevo-SMTP für Supabase (LSB Cockpit) – Schritt für Schritt

Zweck: Supabase verschickt die Anmeldecodes per E-Mail (an m.voehringer@kabsi.at). Ohne eigenen SMTP-Dienst gehen Mails nur an Mitglieder des Supabase-Teams.
Den SMTP-Schlüssel nur in Supabase eintragen – nicht an Claude weitergeben, nicht in Code oder Vercel.

## 1. Brevo: SMTP-Schlüssel holen

1. app.brevo.com → rechts oben Profil/Name → **SMTP & API** → Reiter **SMTP**.
2. Dort stehen: Server `smtp-relay.brevo.com`, Port `587`, **Login** (Form `xxxxxx@smtp-brevo.com`).
3. **Generate a new SMTP key** → Name „LSB Cockpit Supabase“ → Schlüssel kopieren (wird nur einmal angezeigt).
4. **Senders, Domains & Dedicated IPs** → prüfen, dass `icp-consultants.at` als Domain **authentifiziert** ist (wie bei MGM). Sonst landen die Codes im Spam.

## 2. Supabase: SMTP eintragen

Dashboard → Projekt **lsb-cockpit** → **Authentication** → **Emails** → Reiter **SMTP Settings** → **Enable Custom SMTP** einschalten:

| Feld | Wert |
|---|---|
| Sender email | `noreply@icp-consultants.at` |
| Sender name | `LSB Cockpit` |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Minimum interval between emails | `60` (Standard lassen) |
| Username | Brevo-SMTP-Login (`…@smtp-brevo.com`) |
| Password | der eben erzeugte SMTP-Schlüssel |

→ **Save**.

## 3. Code-Einstellungen

**Authentication → Sign In / Providers → Email**
- Email OTP Expiration: `600` (10 Minuten)
- Email OTP Length: `8`
→ Save.

## 4. Vorlage „Magic Link“ auf Code umstellen

**Authentication → Emails → Templates → Magic Link**

Subject:
```
Dein Anmeldecode für das LSB Cockpit
```

Body (Source):
```html
<p>Dein Anmeldecode für das LSB Cockpit:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Der Code gilt 10 Minuten. Wenn du dich nicht anmelden wolltest, ignoriere diese E-Mail.</p>
```
→ Save. (Kein Link in der Mail – nur der Code.)

## 5. Versandgrenze

**Authentication → Rate Limits** → „Rate limit for sending emails“: `30` pro Stunde → Save.

## Danach

Kurz Bescheid geben – Claude testet den Versand an ein Testpostfach und stellt die Anmeldung auf E-Mail-Code um.
