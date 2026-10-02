-- Chiffre folgt strikt dem Jahr des Erstgesprächs: Die App darf sie anpassen, wenn das Datum des Erstgesprächs in ein anderes Jahr wechselt.
-- Nur für offene Akten und solange keine Honorarnote die Chiffre verwendet (dort steht sie im Buchungstext).
grant update (chiffre) on public.akte to authenticated;

create or replace function privat.akte_chiffre_pruefen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.chiffre is distinct from old.chiffre then
    if old.status <> 'offen' then
      raise exception 'Die Chiffre einer abgeschlossenen Akte kann nicht mehr geändert werden.';
    end if;
    if exists (select 1 from public.fin_honorarnote h where h.akte_id = old.id) then
      raise exception 'Zu dieser Chiffre gibt es bereits Honorarnoten – die Chiffre kann nicht mehr geändert werden.';
    end if;
  end if;
  return new;
end $$;

create trigger akte_chiffre_pruefen before update of chiffre on public.akte
  for each row execute function privat.akte_chiffre_pruefen();
