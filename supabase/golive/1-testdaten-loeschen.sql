-- Go-live, Schritt 1: ALLE fiktiven Testdaten endgültig löschen (Testpraxis, Testkonten, deren Protokoll).
-- NICHT als Migration einspielen. Ausführen nur nach ausdrücklicher Freigabe durch ICP (Jörgen), siehe docs/Go-live.md.
--
-- Teil A (Trockenlauf) ändert nichts und zeigt, was gelöscht würde.
-- Teil B löscht in EINER Transaktion und bricht ab, wenn
--   • eine Praxis ohne einstellungen.test = true betroffen wäre,
--   • ein Konto außerhalb von @lsb-cockpit.invalid betroffen wäre,
--   • danach noch Testdaten übrig sind.
-- Die Dateien in den Speicher-Buckets „belege“ und „dokumente“ (verschlüsselte Testdateien) vorher im Dashboard löschen
-- (Storage → Bucket → Ordner der Testpraxis) – Supabase erlaubt kein direktes Löschen über SQL.

-- ===================== Teil A: Trockenlauf =====================
with p as (select id from public.praxis where einstellungen->>'test' = 'true'),
     u as (select user_id from public.benutzer where praxis_id in (select id from p))
select 'praxis (Test)' as was, count(*) from p
union all select 'konten der Testpraxis', count(*) from u
union all select 'davon NICHT @lsb-cockpit.invalid (muss 0 sein)', count(*) from auth.users where id in (select user_id from u) and email not like '%@lsb-cockpit.invalid'
union all select 'konten @lsb-cockpit.invalid ohne Praxis', count(*) from auth.users where email like '%@lsb-cockpit.invalid' and id not in (select user_id from u)
union all select 'akte', count(*) from public.akte where praxis_id in (select id from p)
union all select 'sitzung', count(*) from public.sitzung where praxis_id in (select id from p)
union all select 'protokoll_version', count(*) from public.protokoll_version where praxis_id in (select id from p)
union all select 'register_eintrag', count(*) from public.register_eintrag where praxis_id in (select id from p)
union all select 'fin_kategorie', count(*) from public.fin_kategorie where praxis_id in (select id from p)
union all select 'fin_buchung', count(*) from public.fin_buchung where praxis_id in (select id from p)
union all select 'fin_beleg', count(*) from public.fin_beleg where praxis_id in (select id from p)
union all select 'fin_honorarnote', count(*) from public.fin_honorarnote where praxis_id in (select id from p)
union all select 'support_freigabe', count(*) from public.support_freigabe where praxis_id in (select id from p)
union all select 'loeschprotokoll', count(*) from public.loeschprotokoll where praxis_id in (select id from p)
union all select 'stammdaten', count(*) from public.stammdaten where praxis_id in (select id from p)
union all select 'stammdaten_dokument', count(*) from public.stammdaten_dokument where praxis_id in (select id from p)
union all select 'dateien im bucket dokumente', count(*) from storage.objects where bucket_id = 'dokumente'
union all select 'audit_log', count(*) from public.audit_log where praxis_id in (select id from p)
union all select 'dateien im bucket belege', count(*) from storage.objects where bucket_id = 'belege';

-- ===================== Teil B: Löschen =====================
-- (Zum Ausführen den Block unten einzeln starten.)
/*
begin;

do $$
declare
  test_praxen uuid[];
  test_konten uuid[];
  rest bigint;
begin
  select array_agg(id) into test_praxen from public.praxis where einstellungen->>'test' = 'true';
  if test_praxen is null then raise exception 'Keine Testpraxis gefunden – nichts zu tun.'; end if;

  select array_agg(distinct id) into test_konten from auth.users
   where email like '%@lsb-cockpit.invalid'
      or id in (select user_id from public.benutzer where praxis_id = any(test_praxen));

  if exists (select 1 from auth.users where id = any(test_konten) and email not like '%@lsb-cockpit.invalid') then
    raise exception 'Abbruch: Ein Konto der Testpraxis hat keine @lsb-cockpit.invalid-Adresse.';
  end if;
  if exists (select 1 from public.benutzer where user_id = any(test_konten) and praxis_id <> all(test_praxen)) then
    raise exception 'Abbruch: Ein Testkonto gehört zu einer echten Praxis.';
  end if;

  -- Reihenfolge nach Fremdschlüsseln (Kinder zuerst)
  delete from public.support_freigabe  where praxis_id = any(test_praxen);
  delete from public.loeschprotokoll   where praxis_id = any(test_praxen);
  delete from public.stammdaten_dokument where praxis_id = any(test_praxen);
  delete from public.stammdaten        where praxis_id = any(test_praxen);
  delete from public.fin_honorarnote   where praxis_id = any(test_praxen);
  delete from public.fin_beleg         where praxis_id = any(test_praxen);
  delete from public.fin_buchung       where praxis_id = any(test_praxen);
  delete from public.fin_kategorie     where praxis_id = any(test_praxen);
  delete from public.protokoll_version where praxis_id = any(test_praxen);
  delete from public.register_eintrag  where praxis_id = any(test_praxen);
  delete from public.sitzung           where praxis_id = any(test_praxen);
  delete from public.akte              where praxis_id = any(test_praxen);
  delete from public.audit_log         where praxis_id = any(test_praxen) or user_id = any(test_konten);
  delete from public.benutzer          where user_id = any(test_konten);
  delete from public.praxis            where id = any(test_praxen);
  -- Konten: löscht per Kaskade auch schluesselbund, passkey_schluessel, TOTP-Faktoren, Sitzungen
  delete from auth.users               where id = any(test_konten);

  select (select count(*) from public.praxis where einstellungen->>'test' = 'true')
       + (select count(*) from auth.users where email like '%@lsb-cockpit.invalid')
       + (select count(*) from public.schluesselbund where user_id = any(test_konten))
       + (select count(*) from public.passkey_schluessel where user_id = any(test_konten))
    into rest;
  if rest <> 0 then raise exception 'Abbruch: % Testdatensätze übrig.', rest; end if;
  raise notice 'Testdaten gelöscht: % Praxis/Praxen, % Konten.', array_length(test_praxen, 1), array_length(test_konten, 1);
end $$;

commit;
*/
