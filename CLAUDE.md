# LSB Cockpit – Hinweise für Claude

- Sprache in Code und UI: Deutsch (österreichisch, „Jänner“). Die Beraterin wird geduzt (Stilregel `brand.voice.rules`).
- Grundlage: `LSB_Loesungsdesign_WebApp_v0.1` (Projektordner LSB). Entscheidungen E-01–E-08 vom 28.09.2026: ICP betreibt; Adresse lsb.icp-consultants.at; Passphrase-Ableitung + TOTP, kein Reset per E-Mail; kein eigenes Staging-Projekt.
- **Ende-zu-Ende-Verschlüsselung ist nicht verhandelbar:** Klartext von Klientendaten nie an Server, Logs, Fehlertexte oder Dritte. Ver-/Entschlüsselung nur über `src/lib/crypto/kern.ts` (Web Crypto, keine Fremdbibliothek). AAD immer `aad(tabelle, id, feld)`.
- Schlüssel: Passphrase → PBKDF2 600.000 → KEK → (AES-KW) Master → K_A/K_B/K_C. Anmelde-Geheimnis = PBKDF2 mit Salt „auth“ + E-Mail (Supabase-Passwort). Wiederherstellungscode 128 Bit (Crockford) → HKDF → zweite Master-Kopie. `schluesselbund` nur anhängen (höchste Version gilt).
- Tresor (`src/lib/tresor.tsx`): entpackte Schlüssel nur im Arbeitsspeicher, Sperre nach 10 Min. Seiten unter `(app)` nur mit offenem Tresor.
- Supabase-Projekt `lsb-cockpit` (ref `mndfkacmmjhvkhvxgbkz`, eu-central-1). „Automatically expose new tables“ ist AUS → jede neue Tabelle braucht in der Migration RLS **und** ausdrückliche GRANTs. RLS-Hilfsfunktionen im nicht freigegebenen Schema `privat` (`privat.ist_aal2()`, `privat.meine_praxis()`); Datenzugriff nur mit AAL2.
- Migrationen: `supabase/migrations/<version>_<name>.sql`, Version = Remote-Version aus `list_migrations` (per Supabase-MCP `apply_migration`, danach Datei exakt so speichern). Danach `get_advisors` (security + performance).
- Protokoll-Modul (29.09.2026): `akte` (Chiffre K-JJ-NNNN-XX, Testpraxis „T-“), `sitzung` (Klartext-Metadaten, Entwurf in `entwurf_enc`), `protokoll_version` (nur anhängen, Inhalt K_B), `register_eintrag` (Zone C, K_C; altes Prototyp-Kürzel als `kuerzel_alt`). Logik in `src/lib/protokolle/`, Übernahme aus dem Prototyp über `herkunft` (idempotent). Nachweisliste nur aus Metadaten.
- Diktat: `public/asr/` (Whisper-Worker, eigene CSP in next.config.ts, vom Proxy ausgenommen), `src/lib/diktat.ts`, `src/components/DiktatFeld.tsx`. Ton wird nie gespeichert.
- Lokal starten: Windows blockiert die native Next-SWC (Application Control) → `next dev --webpack` (siehe LSB/.claude/launch.json „cockpit“).
- Kein Service-Role-Schlüssel in Vercel oder im Code. Konten legt ICP lokal mit `scripts/konto-anlegen.mjs` an.
- Tests: `npm test` (Krypto-Kern, läuft im Build – Fehler = kein Deployment). `npx vitest run --config vitest.e2e.config.ts` mit E2E_EMAIL/E2E_EINRICHTUNGSCODE nur gegen das fiktive Testkonto `test-beraterin@lsb-cockpit.invalid` (vor Go-live löschen).
- Branches: `main` = Produktion (derzeit der Diktat-Prototyp, Melanie arbeitet damit!). Cockpit-Entwicklung auf `cockpit` (Vercel-Preview, geschützt). Umstellung erst nach E-07 (externe Prüfung).
- Lieferweg: Dateien direkt schreiben; Jörgen pusht mit `push.ps1` (bzw. Claude nach Freigabe).
