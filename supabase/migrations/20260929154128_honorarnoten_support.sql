-- 1) Praxis-Einstellungen durch die Beraterin änderbar (Absender, Bank, Honorarsatz – keine Klientendaten)
create policy praxis_aendern on public.praxis for update to authenticated
  using ((select privat.ist_aal2()) and id = (select privat.meine_praxis()))
  with check (id = (select privat.meine_praxis()));
grant update (einstellungen) on public.praxis to authenticated;

-- 2) Honorarnoten: Nummer, Datum, Betrag, Status und abgerechnete Sitzungen im Klartext (pseudonym);
--    Empfänger (Name, Adresse) und Positionstexte verschlüsselt mit K_A.
create table public.fin_honorarnote (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  jahr integer not null check (jahr between 2020 and 2100),
  laufnr integer not null check (laufnr > 0),
  datum date not null,
  akte_id uuid not null references public.akte (id),
  sitzung_ids uuid[] not null default '{}',
  betrag numeric(12, 2) not null check (betrag > 0),
  status text not null default 'offen' check (status in ('offen', 'bezahlt', 'storniert')),
  bezahlt_am date,
  buchung_id uuid references public.fin_buchung (id) on delete set null,
  inhalt_enc text not null,
  erstellt_am timestamptz not null default now(),
  unique (praxis_id, jahr, laufnr)
);
create index fin_honorarnote_praxis_idx on public.fin_honorarnote (praxis_id, jahr);
create index fin_honorarnote_akte_idx on public.fin_honorarnote (akte_id);
create index fin_honorarnote_buchung_idx on public.fin_honorarnote (buchung_id);
alter table public.fin_honorarnote enable row level security;
create policy fin_honorarnote_lesen on public.fin_honorarnote for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy fin_honorarnote_anlegen on public.fin_honorarnote for insert to authenticated
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis())
    and exists (select 1 from public.akte a where a.id = akte_id and a.praxis_id = (select privat.meine_praxis())));
create policy fin_honorarnote_aendern on public.fin_honorarnote for update to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()))
  with check (praxis_id = (select privat.meine_praxis()));
revoke all on public.fin_honorarnote from anon, authenticated, service_role;
grant select, insert on public.fin_honorarnote to authenticated;
grant update (status, bezahlt_am, buchung_id) on public.fin_honorarnote to authenticated;

-- 3) Support-Zugang (ICP), technisch ohne Inhalte: nur mit aktiver, befristeter Freigabe der Beraterin
alter table public.benutzer drop constraint benutzer_rolle_check;
alter table public.benutzer add constraint benutzer_rolle_check check (rolle in ('beraterin', 'support'));

create table public.support_freigabe (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  gueltig_bis timestamptz not null,
  beendet_am timestamptz,
  erstellt_am timestamptz not null default now(),
  check (gueltig_bis > erstellt_am and gueltig_bis <= erstellt_am + interval '8 days')
);
create index support_freigabe_praxis_idx on public.support_freigabe (praxis_id, gueltig_bis);
alter table public.support_freigabe enable row level security;

-- Praxis, für die der angemeldete Support-Benutzer gerade freigegeben ist (sonst NULL)
create or replace function privat.support_praxis() returns uuid
language sql stable security definer set search_path = ''
as $$
  select b.praxis_id from public.benutzer b
  where b.user_id = (select auth.uid()) and b.rolle = 'support'
    and exists (select 1 from public.support_freigabe f where f.praxis_id = b.praxis_id and f.beendet_am is null and f.gueltig_bis > now())
$$;
revoke all on function privat.support_praxis() from public, anon;
grant execute on function privat.support_praxis() to authenticated;

create policy freigabe_beraterin on public.support_freigabe for all to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()))
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy freigabe_support_lesen on public.support_freigabe for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select b.praxis_id from public.benutzer b where b.user_id = (select auth.uid()) and b.rolle = 'support'));
revoke all on public.support_freigabe from anon, authenticated, service_role;
grant select, insert on public.support_freigabe to authenticated;
grant update (beendet_am) on public.support_freigabe to authenticated;

-- Lesezugriff des Supports während der Freigabe: Einstellungen, Chiffren, Termine, Audit – keine Namen/Inhalte
create policy praxis_support on public.praxis for select to authenticated
  using ((select privat.ist_aal2()) and id = (select privat.support_praxis()));
create policy akte_support on public.akte for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.support_praxis()));
create policy sitzung_support on public.sitzung for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.support_praxis()));
create policy audit_support_lesen on public.audit_log for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.support_praxis()));
create policy audit_support_anhaengen on public.audit_log for insert to authenticated
  with check ((select privat.ist_aal2()) and user_id = (select auth.uid()) and praxis_id = (select privat.support_praxis()));
