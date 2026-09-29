-- Fristen und Löschung (R-09, F-08): Akte abschließen mit Aufbewahrung-bis, Löschung fälliger Akten in einem Schritt, Löschprotokoll.
-- Honorarnoten und Buchungen bleiben (7 Jahre, § 132 BAO); die Akte bleibt als Eintrag „geloescht“ mit Chiffre ohne Inhalte.

alter table public.akte drop constraint if exists akte_status_check;
alter table public.akte add constraint akte_status_check check (status in ('offen', 'abgeschlossen', 'geloescht'));

-- Buchungen verlieren beim Löschen der Sitzung nur die Verknüpfung
alter table public.fin_buchung drop constraint if exists fin_buchung_sitzung_id_fkey;
alter table public.fin_buchung add constraint fin_buchung_sitzung_id_fkey foreign key (sitzung_id) references public.sitzung (id) on delete set null;

-- Löschen nur für abgeschlossene Akten mit abgelaufener Aufbewahrung (Zone B)
create policy version_loeschen_faellig on public.protokoll_version for delete to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis())
    and exists (select 1 from public.sitzung s join public.akte a on a.id = s.akte_id
                where s.id = protokoll_version.sitzung_id and a.status = 'abgeschlossen' and a.aufbewahrung_bis <= current_date));
create policy sitzung_loeschen_faellig on public.sitzung for delete to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis())
    and exists (select 1 from public.akte a where a.id = sitzung.akte_id and a.status = 'abgeschlossen' and a.aufbewahrung_bis <= current_date));
-- Zonen A und C: die Zuordnung zur Akte ist verschlüsselt, daher nur Praxis-Bindung
create policy register_loeschen on public.register_eintrag for delete to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy stammdaten_loeschen on public.stammdaten for delete to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
grant delete on public.protokoll_version, public.register_eintrag, public.stammdaten to authenticated;

-- Löschprotokoll (Nachweis): nur Chiffre, Zeitpunkte und Umfang – keine Inhalte
create table public.loeschprotokoll (
  id uuid primary key default gen_random_uuid(),
  praxis_id uuid not null references public.praxis (id),
  chiffre text not null,
  abschluss_datum date,
  aufbewahrung_bis date,
  geloescht_am timestamptz not null default now(),
  geloescht_von uuid not null default auth.uid() references auth.users (id),
  umfang jsonb not null default '{}'
);
create index loeschprotokoll_praxis_idx on public.loeschprotokoll (praxis_id);
create index loeschprotokoll_user_idx on public.loeschprotokoll (geloescht_von);
alter table public.loeschprotokoll enable row level security;
create policy loeschprotokoll_lesen on public.loeschprotokoll for select to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()));
create policy loeschprotokoll_anlegen on public.loeschprotokoll for insert to authenticated
  with check ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()) and geloescht_von = (select auth.uid()));
revoke all on public.loeschprotokoll from anon, authenticated, service_role;
grant select, insert on public.loeschprotokoll to authenticated;

-- Löschung in einer Transaktion. SECURITY INVOKER: es gelten die RLS-Richtlinien der Beraterin.
-- Register- und Stammdaten-ID kennt nur der Browser (Zuordnung verschlüsselt) und übergibt sie.
create or replace function public.akte_loeschen(p_akte uuid, p_register uuid, p_stammdaten uuid)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  a public.akte%rowtype;
  n_versionen int; n_sitzungen int; n_stamm int := 0; n_register int := 0;
begin
  select * into a from public.akte where id = p_akte;
  if not found then raise exception 'Akte nicht gefunden'; end if;
  if a.status <> 'abgeschlossen' or a.aufbewahrung_bis is null or a.aufbewahrung_bis > current_date then
    raise exception 'Aufbewahrungsfrist noch nicht abgelaufen';
  end if;
  delete from public.protokoll_version v using public.sitzung s where v.sitzung_id = s.id and s.akte_id = p_akte;
  get diagnostics n_versionen = row_count;
  delete from public.sitzung where akte_id = p_akte;
  get diagnostics n_sitzungen = row_count;
  if p_stammdaten is not null then
    delete from public.stammdaten where id = p_stammdaten;
    get diagnostics n_stamm = row_count;
  end if;
  if p_register is not null then
    delete from public.register_eintrag where id = p_register;
    get diagnostics n_register = row_count;
  end if;
  update public.akte set status = 'geloescht', einwilligung_am = null where id = p_akte;
  insert into public.loeschprotokoll (praxis_id, chiffre, abschluss_datum, aufbewahrung_bis, umfang)
  values (a.praxis_id, a.chiffre, a.abschluss_datum, a.aufbewahrung_bis,
          jsonb_build_object('protokollfassungen', n_versionen, 'sitzungen', n_sitzungen, 'stammdaten', n_stamm, 'registereintrag', n_register));
  return jsonb_build_object('protokollfassungen', n_versionen, 'sitzungen', n_sitzungen, 'stammdaten', n_stamm, 'registereintrag', n_register);
end $$;
revoke all on function public.akte_loeschen(uuid, uuid, uuid) from public, anon;
grant execute on function public.akte_loeschen(uuid, uuid, uuid) to authenticated;
