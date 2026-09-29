-- Korrektur: im Unterabfrage-Bezug war „id“ mehrdeutig (hätte protokoll_version.id gemeint)
drop policy sitzung_entwurf_loeschen on public.sitzung;
create policy sitzung_entwurf_loeschen on public.sitzung for delete to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()) and protokoll_status = 'entwurf'
    and not exists (select 1 from public.protokoll_version v where v.sitzung_id = sitzung.id));
