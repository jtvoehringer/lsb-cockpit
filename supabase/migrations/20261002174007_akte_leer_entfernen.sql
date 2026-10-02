-- Leere Akten (versehentlich angelegt oder als Klient:in ohne Protokolle) entfernen bzw. mit einer bestehenden Akte zusammenführen.
-- Nur offene Akten ohne Sitzung und ohne Honorarnote. SECURITY INVOKER: es gelten die RLS-Richtlinien der Beraterin.
create policy akte_leer_loeschen on public.akte for delete to authenticated
  using ((select privat.ist_aal2()) and praxis_id = (select privat.meine_praxis()) and status = 'offen'
    and not exists (select 1 from public.sitzung s where s.akte_id = akte.id)
    and not exists (select 1 from public.fin_honorarnote h where h.akte_id = akte.id));
grant delete on public.akte to authenticated;

-- p_register/p_stammdaten kennt nur der Browser (Zuordnung verschlüsselt). p_ziel: beim Zusammenführen die Akte, die die Angaben übernimmt
-- (der Browser hat den Registereintrag der Ziel-Akte vorher neu verschlüsselt); deren Einwilligungsdatum wird ergänzt.
create or replace function public.akte_leer_entfernen(p_akte uuid, p_register uuid, p_stammdaten uuid, p_ziel uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  a public.akte%rowtype;
begin
  select * into a from public.akte where id = p_akte;
  if not found then raise exception 'Akte nicht gefunden'; end if;
  if a.status <> 'offen' or exists (select 1 from public.sitzung s where s.akte_id = p_akte)
     or exists (select 1 from public.fin_honorarnote h where h.akte_id = p_akte) then
    raise exception 'Nur offene Akten ohne Gespräche und ohne Honorarnote können entfernt werden.';
  end if;
  if p_ziel is not null and a.einwilligung_am is not null then
    update public.akte set einwilligung_am = coalesce(einwilligung_am, a.einwilligung_am) where id = p_ziel;
  end if;
  if p_stammdaten is not null then
    delete from public.stammdaten where id = p_stammdaten;
  end if;
  if p_register is not null then
    delete from public.register_eintrag where id = p_register;
  end if;
  delete from public.akte where id = p_akte;
  if not found then raise exception 'Akte konnte nicht entfernt werden.'; end if;
end $$;
revoke all on function public.akte_leer_entfernen(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.akte_leer_entfernen(uuid, uuid, uuid, uuid) to authenticated;
