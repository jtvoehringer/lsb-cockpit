-- Vermerk „in Ausbildung“ je Protokoll (Klartext-Metadatum, keine Klientendaten): für Beratungen vor der Gewerbeberechtigung,
-- die als Praxisnachweis dienen. Wird im Ausdruck und in der Nachweisliste ausgewiesen.
alter table public.sitzung add column in_ausbildung boolean not null default false;
grant update (in_ausbildung) on public.sitzung to authenticated;
