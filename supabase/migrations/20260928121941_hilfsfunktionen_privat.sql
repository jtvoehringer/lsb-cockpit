-- Hilfsfunktionen der RLS-Regeln aus der Data API nehmen: eigenes, nicht freigegebenes Schema „privat“
create schema if not exists privat;
revoke all on schema privat from public, anon;
grant usage on schema privat to authenticated;

alter function public.meine_praxis() set schema privat;
alter function public.ist_aal2() set schema privat;

-- Von „Enable automatic RLS“ angelegte Ereignisfunktion nicht über die API aufrufbar machen
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;