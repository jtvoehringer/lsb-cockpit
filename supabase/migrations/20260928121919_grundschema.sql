-- LSB Cockpit · Grundschema: Praxis, Benutzer, Schlüsselbund, Audit-Protokoll
-- Zugriff nur für die Rolle „beraterin“ derselben Praxis mit Sicherheitsstufe AAL2 (Passwort + TOTP).
-- Neue Tabellen werden nicht automatisch über die Data API freigegeben – Rechte stehen hier ausdrücklich.

create table public.praxis (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  einstellungen jsonb not null default '{}'::jsonb,
  erstellt_am timestamptz not null default now()
);

create table public.benutzer (
  user_id uuid primary key references auth.users (id) on delete cascade,
  praxis_id uuid not null references public.praxis (id),
  rolle text not null check (rolle in ('beraterin')),
  eingerichtet_am timestamptz,
  erstellt_am timestamptz not null default now()
);
create index benutzer_praxis_idx on public.benutzer (praxis_id);

-- Verpackte Schlüssel: nur anhängen, nie überschreiben. Gültig ist je Art die höchste Version.
create table public.schluesselbund (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  art text not null check (art in ('master', 'notfall', 'zone_a', 'zone_b', 'zone_c')),
  version integer not null check (version >= 1),
  verpackt text not null,          -- Base64, AES-KW
  kdf jsonb,                       -- Parameter der Ableitung (bei master/notfall), z. B. {"alg":"PBKDF2-SHA256","iter":600000,"salt":"…"}
  erstellt_am timestamptz not null default now(),
  unique (user_id, art, version)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  praxis_id uuid not null references public.praxis (id),
  user_id uuid not null default auth.uid() references auth.users (id),
  zeitpunkt timestamptz not null default now(),
  ereignis text not null check (char_length(ereignis) <= 64),
  objekt text check (char_length(objekt) <= 128),
  ergebnis text check (char_length(ergebnis) <= 32)
);
create index audit_log_praxis_zeit_idx on public.audit_log (praxis_id, zeitpunkt desc);
create index audit_log_user_idx on public.audit_log (user_id);
create index schluesselbund_user_idx on public.schluesselbund (user_id);

-- Hilfsfunktionen (security definer, damit RLS auf benutzer nicht rekursiv greift)
create or replace function public.ist_aal2() returns boolean
language sql stable set search_path = ''
as $$ select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false) $$;

create or replace function public.meine_praxis() returns uuid
language sql stable security definer set search_path = ''
as $$ select b.praxis_id from public.benutzer b where b.user_id = (select auth.uid()) and b.rolle = 'beraterin' $$;

revoke all on function public.meine_praxis() from public, anon;
revoke all on function public.ist_aal2() from public, anon;
grant execute on function public.meine_praxis() to authenticated;
grant execute on function public.ist_aal2() to authenticated;

alter table public.praxis enable row level security;
alter table public.benutzer enable row level security;
alter table public.schluesselbund enable row level security;
alter table public.audit_log enable row level security;

create policy praxis_lesen on public.praxis for select to authenticated
  using ((select public.ist_aal2()) and id = (select public.meine_praxis()));

create policy benutzer_lesen on public.benutzer for select to authenticated
  using ((select public.ist_aal2()) and user_id = (select auth.uid()));

create policy benutzer_einrichtung on public.benutzer for update to authenticated
  using ((select public.ist_aal2()) and user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy schluesselbund_lesen on public.schluesselbund for select to authenticated
  using ((select public.ist_aal2()) and user_id = (select auth.uid()));

create policy schluesselbund_anhaengen on public.schluesselbund for insert to authenticated
  with check ((select public.ist_aal2()) and user_id = (select auth.uid()) and (select public.meine_praxis()) is not null);

create policy audit_lesen on public.audit_log for select to authenticated
  using ((select public.ist_aal2()) and praxis_id = (select public.meine_praxis()));

create policy audit_anhaengen on public.audit_log for insert to authenticated
  with check ((select public.ist_aal2()) and user_id = (select auth.uid()) and praxis_id = (select public.meine_praxis()));

-- Ausdrückliche Rechte (anon bekommt nichts)
revoke all on public.praxis, public.benutzer, public.schluesselbund, public.audit_log from anon, authenticated;
grant select on public.praxis to authenticated;
grant select on public.benutzer to authenticated;
grant update (eingerichtet_am) on public.benutzer to authenticated;
grant select, insert on public.schluesselbund to authenticated;
grant select, insert on public.audit_log to authenticated;
