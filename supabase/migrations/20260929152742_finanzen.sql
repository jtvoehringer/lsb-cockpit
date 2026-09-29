-- LSB Cockpit · Finanzen (Einnahmen-Ausgaben-Rechnung, Kleinunternehmerin – ohne USt)
-- Klartext: Datum, Betrag, Art, Kategorie, Zahlungsart (für Summen in der Datenbank).
-- Verschlüsselt (K_A): Beschreibung, Belegdatei und deren Metadaten – dort können Namen von Klient:innen stehen.

create table public.fin_kategorie (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  name text not null check (char_length(name) between 1 and 80),
  art text not null check (art in ('einnahme', 'ausgabe')),
  e1a_kz text check (e1a_kz ~ '^[0-9]{4}$'),
  sortierung integer not null default 100,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  unique (praxis_id, art, name)
);

create table public.fin_buchung (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  art text not null check (art in ('einnahme', 'ausgabe')),
  datum date not null,
  betrag numeric(12, 2) not null check (betrag > 0),
  kategorie_id uuid not null references public.fin_kategorie (id),
  zahlungsart text not null default 'bank' check (zahlungsart in ('bank', 'bar', 'karte')),
  beschreibung_enc text,
  sitzung_id uuid references public.sitzung (id),
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create table public.fin_beleg (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  buchung_id uuid not null references public.fin_buchung (id) on delete cascade,
  pfad text not null unique,          -- <praxis_id>/<uuid> im Bucket „belege“ (Inhalt verschlüsselt)
  meta_enc text not null,             -- Dateiname, Typ, Größe (K_A)
  erstellt_am timestamptz not null default now()
);

create index fin_kategorie_praxis_idx on public.fin_kategorie (praxis_id);
create index fin_buchung_praxis_datum_idx on public.fin_buchung (praxis_id, datum);
create index fin_buchung_kategorie_idx on public.fin_buchung (kategorie_id);
create index fin_buchung_sitzung_idx on public.fin_buchung (sitzung_id);
create index fin_beleg_buchung_idx on public.fin_beleg (buchung_id);
create index fin_beleg_praxis_idx on public.fin_beleg (praxis_id);

alter table public.fin_kategorie enable row level security;
alter table public.fin_buchung enable row level security;
alter table public.fin_beleg enable row level security;

create policy fin_kategorie_alles on public.fin_kategorie for all to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()))
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));

create policy fin_buchung_alles on public.fin_buchung for all to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()))
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis())
    and exists (select 1 from public.fin_kategorie k where k.id = kategorie_id and k.praxis_id = (select privat.meine_praxis()) and k.art = fin_buchung.art));

create policy fin_beleg_lesen on public.fin_beleg for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy fin_beleg_anlegen on public.fin_beleg for insert to authenticated
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis())
    and pfad like (select privat.meine_praxis())::text || '/%'
    and exists (select 1 from public.fin_buchung b where b.id = buchung_id and b.praxis_id = (select privat.meine_praxis())));
create policy fin_beleg_loeschen on public.fin_beleg for delete to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));

revoke all on public.fin_kategorie, public.fin_buchung, public.fin_beleg from anon, authenticated, service_role;
grant select, insert on public.fin_kategorie to authenticated;
grant update (name, e1a_kz, sortierung, aktiv) on public.fin_kategorie to authenticated;
grant select, insert, delete on public.fin_buchung to authenticated;
grant update (datum, betrag, kategorie_id, zahlungsart, beschreibung_enc, geaendert_am) on public.fin_buchung to authenticated;
grant select, insert, delete on public.fin_beleg to authenticated;

-- Speicher für Belege: privat, Dateien sind im Browser verschlüsselt (application/octet-stream)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('belege', 'belege', false, 15728640, array['application/octet-stream'])
on conflict (id) do nothing;

create policy belege_lesen on storage.objects for select to authenticated
  using (bucket_id = 'belege' and (select privat.ist_aal2()) and (storage.foldername(name))[1] = (select privat.meine_praxis())::text);
create policy belege_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'belege' and (select privat.ist_aal2()) and (storage.foldername(name))[1] = (select privat.meine_praxis())::text);
create policy belege_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'belege' and (select privat.ist_aal2()) and (storage.foldername(name))[1] = (select privat.meine_praxis())::text);

-- Jahressummen je Kategorie (für die Übersicht; rechnet nur auf Klartext-Beträgen, Rechte über RLS)
create or replace function public.fin_jahressummen(jahr integer)
returns table (monat integer, art text, kategorie_id uuid, summe numeric, anzahl bigint)
language sql stable security invoker set search_path = ''
as $$
  select extract(month from b.datum)::int, b.art, b.kategorie_id, sum(b.betrag), count(*)
  from public.fin_buchung b
  where b.datum >= make_date(jahr, 1, 1) and b.datum < make_date(jahr + 1, 1, 1)
  group by 1, 2, 3
$$;
revoke all on function public.fin_jahressummen(integer) from public, anon;
grant execute on function public.fin_jahressummen(integer) to authenticated;
