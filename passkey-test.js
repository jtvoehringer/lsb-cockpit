// Passkey-Test (WebAuthn-Erweiterung PRF): Kann dieses Gerät aus einem Passkey einen stabilen Schlüssel ableiten?
// Genau das braucht das LSB Cockpit, um ohne Passphrase zu entsperren. Keine Daten verlassen das Gerät außer dem,
// was der Browser für Passkeys ohnehin tut; der Server ist nicht beteiligt.
const $ = (s) => document.querySelector(s);
const SPEICHER = 'lsb-passkey-test';
const SALZ = new TextEncoder().encode('lsb-cockpit/prf-test/v1'.padEnd(32, '.')).slice(0, 32);
const bericht = { zeit: new Date().toISOString(), adresse: location.host, browser: navigator.userAgent };

const laden = () => { try { return JSON.parse(localStorage.getItem(SPEICHER) || '{}') } catch { return {} } };
const speichern = (d) => { try { localStorage.setItem(SPEICHER, JSON.stringify(d)) } catch { /* optional */ } };
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ausB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function fingerabdruck(buf) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  return Array.from(h.slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join('');
}
const zeile = (ok, text) => `<span class="${ok ? 'ok' : 'nein'}">${ok ? '✓' : '✗'}</span> ${text}`;

function zeigeBericht() { $('#bericht').textContent = JSON.stringify(bericht, null, 2) }

async function pruefen() {
  const out = []
  const webauthn = !!window.PublicKeyCredential
  bericht.webauthn = webauthn
  out.push(zeile(webauthn, 'Passkeys werden vom Browser unterstützt'))
  if (webauthn) {
    let plattform = false
    try { plattform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() } catch { /* */ }
    bericht.geraeteEntsperrung = plattform
    out.push(zeile(plattform, 'Geräte-Entsperrung verfügbar (Windows Hello / Face ID / Fingerabdruck)'))
    if (PublicKeyCredential.getClientCapabilities) {
      try {
        const f = await PublicKeyCredential.getClientCapabilities()
        bericht.faehigkeiten = f
        out.push(zeile(!!f['extension:prf'], `Schlüssel-Erweiterung PRF laut Browser ${f['extension:prf'] ? 'unterstützt' : 'nicht gemeldet'}`))
      } catch { /* */ }
    } else out.push('ℹ Browser meldet seine Fähigkeiten nicht – der Test in Schritt 2 und 3 zeigt es.')
  }
  $('#pruefung').innerHTML = out.join('<br>')
  if (laden().id) $('#entsperren').disabled = false
  zeigeBericht()
}

$('#anlegen').addEventListener('click', async () => {
  const el = $('#anlegen-ergebnis'); el.hidden = false; el.textContent = 'Bitte am Gerät bestätigen …'
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      rp: { name: 'LSB Cockpit' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'LSB Cockpit – Test', displayName: 'LSB Cockpit – Test' },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      timeout: 120000,
      extensions: { prf: { eval: { first: SALZ } } },
    } })
    const ext = cred.getClientExtensionResults()
    bericht.anlegen = { ok: true, prfAktiviert: ext.prf?.enabled ?? null, prfSofort: !!ext.prf?.results?.first, geraet: cred.authenticatorAttachment ?? null, wege: cred.response.getTransports?.() ?? null }
    const d = { id: b64u(cred.rawId) }
    if (ext.prf?.results?.first) d.fp = await fingerabdruck(ext.prf.results.first)
    speichern(d)
    el.innerHTML = [
      zeile(true, `Passkey angelegt (${cred.authenticatorAttachment === 'platform' ? 'auf diesem Gerät' : cred.authenticatorAttachment === 'cross-platform' ? 'auf einem anderen Gerät/Sicherheitsschlüssel' : 'Speicherort unbekannt'})`),
      zeile(ext.prf?.enabled === true, ext.prf?.enabled === true ? 'Schlüssel-Erweiterung PRF aktiv' : ext.prf?.enabled === false ? 'Schlüssel-Erweiterung PRF NICHT verfügbar' : 'PRF-Status unbekannt – Schritt 3 zeigt es'),
    ].join('<br>')
    $('#entsperren').disabled = false
  } catch (e) {
    bericht.anlegen = { ok: false, fehler: `${e.name}: ${e.message}` }
    el.innerHTML = zeile(false, `Abgebrochen oder nicht möglich: ${e.name}`)
  }
  zeigeBericht()
})

$('#entsperren').addEventListener('click', async () => {
  const el = $('#entsperren-ergebnis'); el.hidden = false; el.textContent = 'Bitte am Gerät bestätigen …'
  const d = laden()
  try {
    const cred = await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: d.id ? [{ type: 'public-key', id: ausB64u(d.id) }] : [],
      userVerification: 'required',
      timeout: 120000,
      extensions: { prf: { eval: { first: SALZ } } },
    } })
    const erste = cred.getClientExtensionResults().prf?.results?.first
    if (!erste) {
      bericht.entsperren = [...(bericht.entsperren || []), { ok: false, grund: 'kein PRF-Ergebnis' }]
      el.innerHTML = zeile(false, 'Entsperrt, aber das Gerät liefert keinen Schlüssel (PRF). Für das Cockpit reicht das nicht.')
    } else {
      // Schlüssel ableiten und benutzen – wie später im Cockpit
      const basis = await crypto.subtle.importKey('raw', erste, 'HKDF', false, ['deriveKey'])
      const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(16), info: new TextEncoder().encode('lsb-cockpit/prf-test') }, basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('Test'))
      const zurueck = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct))
      const fp = await fingerabdruck(erste)
      const gleich = d.fp ? d.fp === fp : null
      if (!d.fp) speichern({ ...d, fp })
      bericht.entsperren = [...(bericht.entsperren || []), { ok: true, laenge: erste.byteLength, gleicherSchluessel: gleich, verschluesselt: zurueck === 'Test' }]
      el.innerHTML = [
        zeile(true, `Schlüssel erhalten (${erste.byteLength * 8} Bit) und damit ver-/entschlüsselt`),
        gleich === null ? 'ℹ Erster Durchgang gespeichert – bitte noch einmal „Mit Passkey entsperren“.' : zeile(gleich, gleich ? 'Gleicher Schlüssel wie beim ersten Mal – das Verfahren funktioniert auf diesem Gerät.' : 'Anderer Schlüssel als beim ersten Mal – so nicht verwendbar.'),
      ].join('<br>')
    }
  } catch (e) {
    bericht.entsperren = [...(bericht.entsperren || []), { ok: false, fehler: `${e.name}: ${e.message}` }]
    el.innerHTML = zeile(false, `Abgebrochen oder nicht möglich: ${e.name}`)
  }
  zeigeBericht()
})

$('#kopieren').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#bericht').textContent); $('#kopieren').textContent = 'Kopiert ✓' } catch { $('#kopieren').textContent = 'Bitte Text markieren und kopieren' }
})

pruefen()
