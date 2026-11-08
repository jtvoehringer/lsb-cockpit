-- 08.11.2026: Protokoll-Nummern folgen dem Beratungsdatum (nicht dem Erfassungsdatum), lückenlos je Praxis.
-- Reihenfolge: Datum, Beginn (ohne Zeit zuletzt), Erfassung, id. Neu-Nummerierung nach Anlegen, Datums-/Zeitänderung und Löschen.
create or replace function privat.sitzung_nummern_ordnen(p_praxis uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  with o as (
    select id, row_number() over (order by datum, beginn nulls last, erstellt_am, id) as rn
    from public.sitzung where praxis_id = p_praxis
  )
  update public.sitzung s set nr = o.rn + 1000000 from o where s.id = o.id and s.nr <> o.rn;
  update public.sitzung set nr = nr - 1000000 where praxis_id = p_praxis and nr > 1000000;
end $$;
revoke all on function privat.sitzung_nummern_ordnen(uuid) from public, anon, authenticated;

create or replace function privat.sitzung_nummern_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform privat.sitzung_nummern_ordnen(coalesce(new.praxis_id, old.praxis_id));
  return null;
end $$;
revoke all on function privat.sitzung_nummern_trigger() from public, anon, authenticated;

create trigger sitzung_nummern_nach_datum
  after insert or delete or update of datum, beginn on public.sitzung
  for each row execute function privat.sitzung_nummern_trigger();

-- Einmalig: Bestand nach Beratungsdatum neu nummerieren
do $$ declare p uuid; begin
  for p in select distinct praxis_id from public.sitzung loop perform privat.sitzung_nummern_ordnen(p); end loop;
end $$;

-- Einheit = 60 Minuten (vorher 50): gespeicherte Arbeitseinheiten neu berechnen (noch keine Honorarnoten vorhanden)
update public.sitzung set arbeitseinheiten = nullif(round((extract(epoch from (ende - beginn)) / 60
    + case when ende < beginn then 1440 else 0 end)::numeric / 60, 2), 0)
  where beginn is not null and ende is not null;
