-- LSB Cockpit · Protokoll-Modul (Zone B) und Register (Zone C)
-- Klartext nur pseudonyme Metadaten (Chiffre, Datum, Zeiten, Einheiten, Status). Inhalte ausschließlich verschlüsselt (*_enc).

create table public.akte (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  chiffre text not null check (chiffre ~ '^(T-)?K-[0-9]{2}-[0-9]{4}-[A-HJ-NP-Z]{2}$'),
  status text not null default 'offen' check (status in ('offen', 'abgeschlossen')),
  abschluss_datum date,
  aufbewahrung_bis date,
  erstellt_am timestamptz not null default now(),
  unique (praxis_id, chiffre)
);

create table public.sitzung (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  akte_id uuid not null references public.akte (id),
  nr integer not null check (nr > 0),
  art text not null check (art in ('erst', 'folge')),
  datum date not null,
  beginn time,
  ende time,
  arbeitseinheiten numeric(5, 2) check (arbeitseinheiten >= 0),
  vorbereitung_min integer not null default 0 check (vorbereitung_min between 0 and 1440),
  nachbereitung_min integer not null default 0 check (nachbereitung_min between 0 and 1440),
  prozess_abgeschlossen boolean not null default false,
  protokoll_status text not null default 'entwurf' check (protokoll_status in ('entwurf', 'abgeschlossen')),
  abgeschlossen_am timestamptz,
  entwurf_enc text,                 -- laufender Entwurf (K_B); Versionen entstehen beim Abschließen/Korrigieren
  herkunft text,                    -- ID aus dem Diktat-Prototyp (verhindert doppelte Übernahme)
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  unique (praxis_id, nr),
  unique (praxis_id, herkunft)
);

-- Protokollinhalte: nur anhängen, nie überschreiben (F-07)
create table public.protokoll_version (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  sitzung_id uuid not null references public.sitzung (id),
  version integer not null check (version >= 1),
  inhalt_enc text not null,
  erstellt_am timestamptz not null default now(),
  unique (sitzung_id, version)
);

-- Zone C: Zuordnung Chiffre ↔ Person (alles verschlüsselt mit K_C)
create table public.register_eintrag (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  inhalt_enc text not null,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create index akte_praxis_idx on public.akte (praxis_id);
create index sitzung_akte_idx on public.sitzung (akte_id);
create index sitzung_praxis_datum_idx on public.sitzung (praxis_id, datum);
create index protokoll_version_sitzung_idx on public.protokoll_version (sitzung_id);
create index protokoll_version_praxis_idx on public.protokoll_version (praxis_id);
create index register_eintrag_praxis_idx on public.register_eintrag (praxis_id);

alter table public.akte enable row level security;
alter table public.sitzung enable row level security;
alter table public.protokoll_version enable row level security;
alter table public.register_eintrag enable row level security;

-- Gleiche Regel überall: AAL2 und eigene Praxis
create policy akte_lesen on public.akte for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy akte_anlegen on public.akte for insert to authenticated
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy akte_aendern on public.akte for update to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()))
  with check (praxis_id = (select privat.meine_praxis()));

create policy sitzung_lesen on public.sitzung for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy sitzung_anlegen on public.sitzung for insert to authenticated
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis())
    and exists (select 1 from public.akte a where a.id = akte_id and a.praxis_id = (select privat.meine_praxis())));
create policy sitzung_aendern on public.sitzung for update to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()))
  with check (praxis_id = (select privat.meine_praxis()));
create policy sitzung_entwurf_loeschen on public.sitzung for delete to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()) and protokoll_status = 'entwurf'
    and not exists (select 1 from public.protokoll_version v where v.sitzung_id = id));

create policy version_lesen on public.protokoll_version for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy version_anhaengen on public.protokoll_version for insert to authenticated
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis())
    and exists (select 1 from public.sitzung s where s.id = sitzung_id and s.praxis_id = (select privat.meine_praxis())));

create policy register_lesen on public.register_eintrag for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy register_anlegen on public.register_eintrag for insert to authenticated
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy register_aendern on public.register_eintrag for update to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()))
  with check (praxis_id = (select privat.meine_praxis()));

-- Ausdrückliche Rechte (anon nichts; service_role nichts)
revoke all on public.akte, public.sitzung, public.protokoll_version, public.register_eintrag from anon, authenticated, service_role;
grant select, insert on public.akte to authenticated;
grant update (status, abschluss_datum, aufbewahrung_bis) on public.akte to authenticated;
grant select, insert, delete on public.sitzung to authenticated;
grant update (datum, beginn, ende, arbeitseinheiten, vorbereitung_min, nachbereitung_min, prozess_abgeschlossen,
              protokoll_status, abgeschlossen_am, entwurf_enc, geaendert_am) on public.sitzung to authenticated;
grant select, insert on public.protokoll_version to authenticated;
grant select, insert on public.register_eintrag to authenticated;
grant update (inhalt_enc, geaendert_am) on public.register_eintrag to authenticated;

-- Testpraxis kennzeichnen: Chiffren mit Präfix „T-“
update public.praxis set einstellungen = einstellungen || '{"test": true}'::jsonb where name like 'Testpraxis%';
