-- Zone A: Stammdaten und Einwilligungen (R-04, F-05, F-13, F-14). Inhalt nur verschlüsselt mit K_A.
-- Die Zuordnung Stammdaten ↔ Chiffre steht ausschließlich verschlüsselt im Register (Zone C).
create table public.stammdaten (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  inhalt_enc text not null,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);
create index stammdaten_praxis_idx on public.stammdaten (praxis_id);
alter table public.stammdaten enable row level security;
create policy stammdaten_lesen on public.stammdaten for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy stammdaten_anlegen on public.stammdaten for insert to authenticated
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy stammdaten_aendern on public.stammdaten for update to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()))
  with check (praxis_id = (select privat.meine_praxis()));

-- Unterschriebene Dokumente (Vereinbarung, Einwilligung, Entbindung) als verschlüsselte Dateien
create table public.stammdaten_dokument (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  stammdaten_id uuid not null references public.stammdaten (id) on delete cascade,
  pfad text not null,
  meta_enc text not null,
  erstellt_am timestamptz not null default now()
);
create index stammdaten_dokument_praxis_idx on public.stammdaten_dokument (praxis_id);
create index stammdaten_dokument_stamm_idx on public.stammdaten_dokument (stammdaten_id);
alter table public.stammdaten_dokument enable row level security;
create policy stammdaten_dokument_lesen on public.stammdaten_dokument for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy stammdaten_dokument_anlegen on public.stammdaten_dokument for insert to authenticated
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis())
    and pfad like (select privat.meine_praxis())::text || '/%'
    and exists (select 1 from public.stammdaten s where s.id = stammdaten_id and s.praxis_id = (select privat.meine_praxis())));
create policy stammdaten_dokument_loeschen on public.stammdaten_dokument for delete to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));

revoke all on public.stammdaten, public.stammdaten_dokument from anon, authenticated, service_role;
grant select, insert on public.stammdaten to authenticated;
grant update (inhalt_enc, geaendert_am) on public.stammdaten to authenticated;
grant select, insert, delete on public.stammdaten_dokument to authenticated;

-- Akte: Datum der Datenschutz-Einwilligung (Art. 9) als pseudonymes Kennzeichen für Listen und Hinweise
alter table public.akte add column einwilligung_am date;
grant update (einwilligung_am) on public.akte to authenticated;

-- Speicher für Dokumente: privat, Dateien im Browser verschlüsselt
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokumente', 'dokumente', false, 15728640, array['application/octet-stream'])
on conflict (id) do nothing;
create policy dokumente_lesen on storage.objects for select to authenticated
  using (bucket_id = 'dokumente' and (select privat.ist_aal2()) and (storage.foldername(name))[1] = (select privat.meine_praxis())::text);
create policy dokumente_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumente' and (select privat.ist_aal2()) and (storage.foldername(name))[1] = (select privat.meine_praxis())::text);
create policy dokumente_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'dokumente' and (select privat.ist_aal2()) and (storage.foldername(name))[1] = (select privat.meine_praxis())::text);
