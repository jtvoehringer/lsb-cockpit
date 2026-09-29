-- Entsperren mit Passkey (Windows Hello / Face ID): je Gerät eine weitere Kopie des Master-Schlüssels,
-- verpackt mit einem Schlüssel aus der WebAuthn-PRF-Erweiterung. Der Server sieht nur die verpackte Kopie.
create table public.passkey_schluessel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  credential_id text not null check (char_length(credential_id) <= 1400),
  bezeichnung text not null check (char_length(bezeichnung) between 1 and 60),
  verpackt text not null check (char_length(verpackt) <= 200),
  kdf jsonb not null,
  erstellt_am timestamptz not null default now(),
  unique (user_id, credential_id)
);
alter table public.passkey_schluessel enable row level security;

create policy passkey_lesen on public.passkey_schluessel for select to authenticated
  using ((select privat.ist_aal2()) and user_id = (select auth.uid()));
create policy passkey_anlegen on public.passkey_schluessel for insert to authenticated
  with check ((select privat.ist_aal2()) and user_id = (select auth.uid())
    and exists (select 1 from public.benutzer b where b.user_id = (select auth.uid()) and b.rolle = 'beraterin'));
create policy passkey_entfernen on public.passkey_schluessel for delete to authenticated
  using ((select privat.ist_aal2()) and user_id = (select auth.uid()));

revoke all on public.passkey_schluessel from anon, authenticated, service_role;
grant select, insert, delete on public.passkey_schluessel to authenticated;
grant select, delete on public.passkey_schluessel to service_role;
