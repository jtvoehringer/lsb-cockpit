-- Prüfung der Zugriffsregeln (RLS) als simulierte Benutzer – ändert nichts: der Block endet absichtlich mit einer
-- Ausnahme, dadurch wird alles zurückgerollt. Ergebnis steht in der Fehlermeldung „ERGEBNIS (zurückgerollt): …“.
-- Voraussetzung: je ein Konto mit Rolle „support“ und „beraterin“ in derselben Praxis (Testpraxis).
-- Erwartet (Stand 29.09.2026):
--   SUPPORT mit Freigabe: akte > 0 (gewollt), stammdaten/dokumente/loeschprotokoll/register/versionen/honorarnoten = 0,
--                         löscht stammdaten: 0 Zeilen
--   BERATERIN AAL1: stammdaten 0
--   BERATERIN AAL2: stammdaten ≥ 1, löscht Versionen nicht fälliger Akten: 0 Zeilen, ändert Löschprotokoll: verweigert
do $$
declare sup uuid; ber uuid; p uuid; r text := '';
  n_akte int; n_stamm int; n_dok int; n_loesch int; n_reg int; n_ver int; n_fin int;
begin
  select user_id, praxis_id into sup, p from public.benutzer where rolle = 'support' limit 1;
  select user_id into ber from public.benutzer where rolle = 'beraterin' and praxis_id = p limit 1;
  insert into public.stammdaten (praxis_id, inhalt_enc) values (p, 'x');
  insert into public.support_freigabe (praxis_id, gueltig_bis) values (p, now() + interval '1 hour');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', sup, 'aal', 'aal2', 'role', 'authenticated')::text, true);
  select count(*) into n_akte from public.akte;
  select count(*) into n_stamm from public.stammdaten;
  select count(*) into n_dok from public.stammdaten_dokument;
  select count(*) into n_loesch from public.loeschprotokoll;
  select count(*) into n_reg from public.register_eintrag;
  select count(*) into n_ver from public.protokoll_version;
  select count(*) into n_fin from public.fin_honorarnote;
  r := format('SUPPORT: akte %s, stammdaten %s, dokumente %s, loeschprotokoll %s, register %s, versionen %s, honorarnoten %s', n_akte, n_stamm, n_dok, n_loesch, n_reg, n_ver, n_fin);
  begin
    delete from public.stammdaten; get diagnostics n_stamm = row_count;
    r := r || format(' | Support löscht stammdaten: %s Zeilen', n_stamm);
  exception when others then r := r || ' | Support löscht stammdaten: verweigert (' || sqlerrm || ')'; end;

  perform set_config('request.jwt.claims', json_build_object('sub', ber, 'aal', 'aal1', 'role', 'authenticated')::text, true);
  select count(*) into n_stamm from public.stammdaten;
  r := r || format(' || BERATERIN AAL1: stammdaten %s', n_stamm);

  perform set_config('request.jwt.claims', json_build_object('sub', ber, 'aal', 'aal2', 'role', 'authenticated')::text, true);
  select count(*) into n_stamm from public.stammdaten;
  select count(*) into n_loesch from public.loeschprotokoll;
  begin
    delete from public.protokoll_version v using public.sitzung s, public.akte a
      where v.sitzung_id = s.id and s.akte_id = a.id and (a.status <> 'abgeschlossen' or a.aufbewahrung_bis > current_date);
    get diagnostics n_ver = row_count;
    r := r || format(' || BERATERIN AAL2: stammdaten %s, loeschprotokoll %s, löscht Versionen nicht fälliger Akten: %s Zeilen', n_stamm, n_loesch, n_ver);
  exception when others then r := r || ' || Versionen löschen: ' || sqlerrm; end;
  begin
    update public.loeschprotokoll set chiffre = 'X'; get diagnostics n_loesch = row_count;
    r := r || format(', ändert Löschprotokoll: %s Zeilen', n_loesch);
  exception when others then r := r || ', ändert Löschprotokoll: verweigert'; end;
  raise exception 'ERGEBNIS (zurückgerollt): %', r;
end $$;
