-- Kontoanlage durch ICP (scripts/konto-anlegen.mjs, lokal mit Service-Role-Schlüssel): nur Praxis und Benutzer.
-- Schlüsselbund und Audit-Protokoll bleiben für service_role gesperrt.
grant select, insert, update on public.praxis to service_role;
grant select, insert, update on public.benutzer to service_role;