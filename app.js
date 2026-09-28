// LSB Cockpit – Protokoll-Diktat (Prototyp). Läuft vollständig im Browser; es gibt keinen Server für Daten.
import * as store from "./store.js";

const PRAXIS = "Melanie Vöhringer · Lebens- & Sozialberatung";
const EINHEIT_MIN = 50;
const AUTOLOCK_MIN = 15;

const ART = {
  erst: {
    titel: "Protokoll Erstgespräch",
    kurz: "Erstgespräch",
    felder: [
      ["anliegen", "Ausgangslage, Anliegen, Thema"],
      ["ziele", "Ziele, Kriterien zur Zielerreichung"],
      ["rahmen", "Rahmenbedingungen"],
      ["verlauf", "Verlauf, Maßnahmen, Interventionen"],
      ["ergebnis", "Ergebnisse, future pace"],
    ],
  },
  folge: {
    titel: "Protokoll Beratungsgespräch",
    kurz: "Beratungsgespräch",
    felder: [
      ["anliegen", "Anliegen, Thema, Zielableitung"],
      ["verlauf", "Verlauf, Maßnahmen, Interventionen"],
      ["ergebnis", "Zielerreichung, future pace"],
    ],
  },
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const nf1 = new Intl.NumberFormat("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const datum = (iso) => iso ? new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso + "T12:00")) : "";
const now = () => new Date().toISOString();

let protokolle = [];
let aktuell = null;

// ---------- Hilfen ----------
function toast(msg, ms = 3500) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms);
}
function minuten(p) {
  if (!p.beginn || !p.ende) return 0;
  const [h1, m1] = p.beginn.split(":").map(Number), [h2, m2] = p.ende.split(":").map(Number);
  let d = h2 * 60 + m2 - (h1 * 60 + m1);
  if (d < 0) d += 24 * 60;
  return d;
}
const einheiten = (min) => min / EINHEIT_MIN;
const stunden = (min) => min / 60;

function show(view) {
  for (const v of $$(".view")) v.hidden = v.id !== "view-" + view;
  $("#bar").hidden = view === "lock";
  window.scrollTo(0, 0);
}

// ---------- Sperre ----------
async function showLock() {
  const init = await store.isInitialized();
  $("#lock-title").textContent = init ? "Protokolle entsperren" : "Protokolle einrichten";
  $("#lock-text").textContent = init
    ? "Bitte die Passphrase eingeben."
    : "Wähle eine Passphrase mit mindestens 12 Zeichen, am besten 4–5 zufällige Wörter. Schreib sie auf und bewahre sie sicher auf – ohne sie sind die Protokolle nicht wiederherstellbar.";
  $("#pass2-wrap").hidden = init;
  $("#pass2").required = !init;
  $("#pass1").autocomplete = init ? "current-password" : "new-password";
  $("#lock-submit").textContent = init ? "Entsperren" : "Einrichten";
  $("#lock-error").textContent = "";
  $("#lock-form").reset();
  show("lock");
  $("#pass1").focus();
}

$("#lock-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const p1 = $("#pass1").value, p2 = $("#pass2").value;
  const btn = $("#lock-submit"); btn.disabled = true;
  $("#lock-error").textContent = "";
  try {
    if (!(await store.isInitialized())) {
      if (p1.length < 12) throw new Error("Mindestens 12 Zeichen.");
      if (p1 !== p2) throw new Error("Die beiden Eingaben stimmen nicht überein.");
      await store.init(p1);
      try { await navigator.storage?.persist?.(); } catch { /* optional */ }
    } else if (!(await store.unlock(p1))) {
      throw new Error("Passphrase stimmt nicht.");
    }
    await loadAll();
    showList();
  } catch (err) {
    $("#lock-error").textContent = err.message;
  } finally { btn.disabled = false; }
});

function lockNow() { store.lock(); protokolle = []; aktuell = null; $("#print").innerHTML = ""; showLock(); }
$("#lock-btn").addEventListener("click", lockNow);

// Automatisch sperren nach Inaktivität
let lastActivity = Date.now();
for (const ev of ["pointerdown", "keydown", "scroll"]) addEventListener(ev, () => (lastActivity = Date.now()), { passive: true });
setInterval(() => { if (store.isUnlocked() && !rec.active && Date.now() - lastActivity > AUTOLOCK_MIN * 60_000) { flushSave().finally(lockNow); } }, 30_000);

// ---------- Daten ----------
async function loadAll() { protokolle = (await store.list()).sort((a, b) => (b.datum || "").localeCompare(a.datum || "") || b.nr - a.nr); }
const nextNr = () => Math.max(0, ...protokolle.map((p) => p.nr || 0)) + 1;

// ---------- Liste ----------
function filtered(prefix) {
  const k = $(`#${prefix}-kuerzel`)?.value.trim().toLowerCase() || "";
  const von = $(`#${prefix}-von`).value, bis = $(`#${prefix}-bis`).value;
  return protokolle.filter((p) => (!k || (p.kuerzel || "").toLowerCase().includes(k)) && (!von || p.datum >= von) && (!bis || p.datum <= bis));
}

async function showList() {
  const rows = filtered("f");
  $("#list-body").innerHTML = rows.map((p) => {
    const m = minuten(p);
    return `<tr data-id="${esc(p.id)}" tabindex="0"><td>${esc(p.nr)}</td><td>${datum(p.datum)}</td><td>${esc(p.kuerzel)}</td><td>${ART[p.art].kurz}</td><td class="num">${m ? nf2.format(stunden(m)) + " h" : "–"}</td><td class="num">${m ? nf1.format(einheiten(m)) : "–"}</td><td>${p.status === "abgeschlossen" ? '<span class="tag done">abgeschlossen</span>' : '<span class="tag">Entwurf</span>'}</td></tr>`;
  }).join("");
  $("#list-empty").hidden = protokolle.length > 0;
  await backupHint();
  show("list");
}
for (const id of ["#f-kuerzel", "#f-von", "#f-bis"]) $(id).addEventListener("input", () => showList());
$("#list-body").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) openEdit(tr.dataset.id); });
$("#list-body").addEventListener("keydown", (e) => { if (e.key === "Enter") { const tr = e.target.closest("tr[data-id]"); if (tr) openEdit(tr.dataset.id); } });
$$("[data-go]").forEach((b) => b.addEventListener("click", async () => {
  if (aktuell?._korrektur && dirty && !confirm("Korrektur verwerfen?")) return;
  if (aktuell?._korrektur) { dirty = false; aktuell = null; }
  await flushSave();
  const go = b.dataset.go;
  if (go === "list") showList(); else if (go === "nachweis") showNachweis(); else showSicherung();
}));
$$("[data-new]").forEach((b) => b.addEventListener("click", () => newProtokoll(b.dataset.new)));

async function backupHint() {
  const last = await store.getMeta("lastBackup");
  const changed = protokolle.filter((p) => !last || p.geaendertAm > last).length;
  const el = $("#backup-hint");
  if (protokolle.length && changed) {
    el.innerHTML = `${changed} Protokoll${changed === 1 ? "" : "e"} ${last ? "seit der letzten Sicherung (" + datum(last.slice(0, 10)) + ") geändert" : "noch nie gesichert"}. <button class="btn ghost" data-go-backup>Jetzt sichern</button>`;
    el.hidden = false;
    el.querySelector("[data-go-backup]").addEventListener("click", showSicherung);
  } else el.hidden = true;
}

// ---------- Protokoll bearbeiten ----------
function newProtokoll(art) {
  const d = new Date();
  const p = {
    id: crypto.randomUUID(), nr: nextNr(), art, kuerzel: "", datum: d.toISOString().slice(0, 10),
    beginn: "", ende: "", vorbereitungMin: 15, nachbereitungMin: 15, felder: {},
    prozessAbgeschlossen: false, supervision: false, status: "entwurf",
    erstelltAm: now(), geaendertAm: now(), abgeschlossenAm: null, versionen: [],
  };
  aktuell = p;
  renderEdit();
}

function openEdit(id) { aktuell = structuredClone(protokolle.find((p) => p.id === id)); renderEdit(); }

function renderEdit() {
  const p = aktuell, a = ART[p.art], closed = p.status === "abgeschlossen" && !p._korrektur;
  $("#edit-title").textContent = `${a.titel} Nr. ${p.nr}`;
  $("#e-nr").value = p.nr; $("#e-kuerzel").value = p.kuerzel; $("#e-datum").value = p.datum;
  $("#e-beginn").value = p.beginn; $("#e-ende").value = p.ende;
  $("#e-vor").value = p.vorbereitungMin ?? ""; $("#e-nach").value = p.nachbereitungMin ?? "";
  $("#e-abgeschlossen-prozess").checked = !!p.prozessAbgeschlossen; $("#e-supervision").checked = !!p.supervision;
  $("#fields").innerHTML = a.felder.map(([k, label]) => `
    <div class="field">
      <div class="field-head"><h2 id="h-${k}">${label}</h2>
        <div class="mic">
          <button type="button" class="btn rec" data-rec="${k}" aria-describedby="h-${k}">Diktieren</button>
          <label class="btn ghost file small">Audiodatei<input type="file" accept="audio/*" data-file="${k}"></label>
        </div>
      </div>
      <textarea id="t-${k}" data-feld="${k}" aria-labelledby="h-${k}" spellcheck="true"></textarea>
      <div class="field-state" id="s-${k}" aria-live="polite"></div>
    </div>`).join("");
  for (const [k] of a.felder) $("#t-" + k).value = p.felder[k] || "";
  for (const el of $$("#edit-form input, #edit-form textarea")) el.disabled = closed;
  $$("[data-rec], [data-file]").forEach((b) => (b.disabled = closed));
  $("#closed-note").hidden = p.status !== "abgeschlossen";
  $("#closed-note").textContent = p.status === "abgeschlossen"
    ? (p._korrektur ? "Korrektur: Die bisherige Fassung wird beim Speichern als Version aufbewahrt." : `Abgeschlossen am ${datum(p.abgeschlossenAm.slice(0, 10))}${p.versionen.length ? ` · ${p.versionen.length} frühere Fassung(en)` : ""}. Änderungen nur über „Korrigieren“.`)
    : "";
  $("#close-btn").hidden = closed;
  $("#close-btn").textContent = p._korrektur ? "Korrektur speichern" : "Protokoll abschließen";
  $("#reopen-btn").hidden = !closed;
  $("#delete-btn").hidden = p.status === "abgeschlossen";
  $("#save-state").textContent = "";
  updateCalc();
  show("edit");
  if (!p.kuerzel) $("#e-kuerzel").focus();
}

function readForm() {
  const p = aktuell;
  p.nr = Number($("#e-nr").value) || p.nr;
  p.kuerzel = $("#e-kuerzel").value.trim();
  p.datum = $("#e-datum").value; p.beginn = $("#e-beginn").value; p.ende = $("#e-ende").value;
  p.vorbereitungMin = Number($("#e-vor").value) || 0; p.nachbereitungMin = Number($("#e-nach").value) || 0;
  p.prozessAbgeschlossen = $("#e-abgeschlossen-prozess").checked; p.supervision = $("#e-supervision").checked;
  for (const [k] of ART[p.art].felder) p.felder[k] = $("#t-" + k).value;
}

function updateCalc() {
  const m = minuten({ beginn: $("#e-beginn").value, ende: $("#e-ende").value });
  $("#e-calc").textContent = m ? `${nf2.format(stunden(m))} h · ${nf1.format(einheiten(m))} E` : "–";
  const k = $("#e-kuerzel").value.trim();
  $("#kuerzel-warn").hidden = !(/\s/.test(k) || k.length > 8);
}

// Automatisch speichern (verschlüsselt), sobald sich etwas ändert
let saveTimer = null, dirty = false;
$("#edit-form").addEventListener("input", () => { updateCalc(); dirty = true; $("#save-state").textContent = "…"; clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 800); });
async function flushSave() {
  clearTimeout(saveTimer);
  if (!dirty || !aktuell || !store.isUnlocked()) return;
  if (aktuell.status === "abgeschlossen" && !aktuell._korrektur) { dirty = false; return; }
  readForm();
  if (aktuell._korrektur) { $("#save-state").textContent = "Korrektur – mit „Korrektur speichern“ übernehmen"; return; }
  aktuell.geaendertAm = now();
  await persist(aktuell);
  dirty = false;
  $("#save-state").textContent = "gespeichert (verschlüsselt)";
}
async function persist(p) {
  const clean = structuredClone(p); delete clean._korrektur; delete clean._vorher;
  await store.save(clean);
  const i = protokolle.findIndex((x) => x.id === p.id);
  if (i >= 0) protokolle[i] = clean; else protokolle.push(clean);
  protokolle.sort((a, b) => (b.datum || "").localeCompare(a.datum || "") || b.nr - a.nr);
}

$("#back-btn").addEventListener("click", async () => {
  if (aktuell?._korrektur && dirty && !confirm("Korrektur verwerfen?")) return;
  if (!aktuell?._korrektur) await flushSave();
  dirty = false; showList();
});

$("#close-btn").addEventListener("click", async () => {
  readForm();
  const p = aktuell;
  const fehlt = [];
  if (!p.kuerzel) fehlt.push("Kürzel");
  if (!p.datum) fehlt.push("Datum");
  if (!minuten(p)) fehlt.push("Beginn/Ende");
  if (fehlt.length) { toast("Bitte ausfüllen: " + fehlt.join(", ")); return; }
  if (protokolle.some((x) => x.id !== p.id && x.nr === p.nr)) { toast(`Protokoll-Nr. ${p.nr} ist schon vergeben.`); return; }
  if (p._korrektur) {
    p.versionen = [...(p.versionen || []), { gespeichertAm: now(), fassung: p._vorher }];
    delete p._korrektur; delete p._vorher;
    p.geaendertAm = now();
    await persist(p); dirty = false;
    toast("Korrektur gespeichert, frühere Fassung aufbewahrt.");
  } else {
    if (!confirm("Protokoll abschließen? Danach sind Änderungen nur noch als nachvollziehbare Korrektur möglich.")) return;
    p.status = "abgeschlossen"; p.abgeschlossenAm = now(); p.geaendertAm = now();
    await persist(p); dirty = false;
    toast("Protokoll abgeschlossen.");
  }
  renderEdit();
});

$("#reopen-btn").addEventListener("click", () => {
  const vorher = structuredClone(aktuell); delete vorher.versionen;
  aktuell._vorher = vorher; aktuell._korrektur = true;
  renderEdit();
});

$("#delete-btn").addEventListener("click", async () => {
  if (!confirm("Diesen Entwurf endgültig löschen?")) return;
  if (protokolle.some((p) => p.id === aktuell.id)) await store.remove(aktuell.id);
  protokolle = protokolle.filter((p) => p.id !== aktuell.id);
  dirty = false; aktuell = null; toast("Entwurf gelöscht."); showList();
});

// ---------- Diktat ----------
const worker = new Worker(new URL("./asr-worker.js", import.meta.url), { type: "module" });
const pending = new Map();
let asrReady = false;
worker.onmessage = ({ data }) => {
  if (data.type === "progress") {
    const pct = data.total ? Math.round((data.loaded / data.total) * 100) : 0;
    setAsrState(`Sprachmodell wird geladen (einmalig): ${pct} % – ${data.file}`);
  } else if (data.type === "ready") {
    asrReady = true; setAsrState(`Sprachmodell bereit (${data.model === "genau" ? "genau" : "schnell"}, ${data.device === "webgpu" ? "Grafikchip" : "Prozessor"}).`);
  } else if (data.type === "result" || data.type === "error") {
    const p = pending.get(data.id); pending.delete(data.id);
    if (p) data.type === "result" ? p.resolve(data) : p.reject(new Error(data.message));
  }
};
function setAsrState(t) { $("#asr-state").textContent = t; if (rec.feld) $("#s-" + rec.feld) && ($("#s-" + rec.feld).textContent = t); }
const modelChoice = () => { try { return localStorage.getItem("asrModel") || "schnell"; } catch { return "schnell"; } };
function transcribe(audio) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker.postMessage({ type: "transcribe", id, audio, model: modelChoice() }, [audio.buffer]); });
}

async function toMono16k(blob) {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
    const out = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels; }
    return out;
  } finally { ctx.close(); }
}

const rec = { active: false, feld: null, recorder: null, chunks: [], stream: null };

async function startRec(feld) {
  if (rec.active) return;
  try {
    rec.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch { toast("Kein Zugriff auf das Mikrofon. Bitte im Browser erlauben."); return; }
  rec.recorder = new MediaRecorder(rec.stream);
  rec.chunks = []; rec.feld = feld; rec.active = true;
  rec.recorder.ondataavailable = (e) => e.data.size && rec.chunks.push(e.data);
  rec.recorder.onstop = () => finishRec();
  rec.recorder.start();
  const b = $(`[data-rec="${feld}"]`); b.classList.add("on"); b.textContent = "Stopp";
  $$("[data-rec]").forEach((x) => (x.disabled = x !== b));
  $("#s-" + feld).textContent = "Aufnahme läuft – sprechen, dann „Stopp“.";
  if (!asrReady) worker.postMessage({ type: "load", model: modelChoice() }); // Modell parallel vorbereiten
}

function stopRec() { if (rec.active) rec.recorder.stop(); }

async function finishRec() {
  const feld = rec.feld;
  rec.stream.getTracks().forEach((t) => t.stop());
  const blob = new Blob(rec.chunks, { type: rec.recorder.mimeType });
  rec.chunks = []; rec.active = false;
  const b = $(`[data-rec="${feld}"]`); if (b) { b.classList.remove("on"); b.textContent = "Diktieren"; }
  await transcribeInto(feld, blob);
  rec.feld = null;
  $$("[data-rec]").forEach((x) => (x.disabled = false));
}

async function transcribeInto(feld, blob) {
  const state = $("#s-" + feld);
  state.textContent = "Wird in Text umgewandelt … (auf diesem Gerät)";
  try {
    const audio = await toMono16k(blob); // Tonaufnahme bleibt nur im Arbeitsspeicher und wird nicht gespeichert
    const r = await transcribe(audio);
    const ta = $("#t-" + feld);
    if (ta && r.text) {
      ta.value = ta.value.trim() ? ta.value.trimEnd() + "\n" + r.text : r.text;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    state.textContent = r.text ? `Übernommen (${(r.ms / 1000).toFixed(1).replace(".", ",")} s). Bitte kurz gegenlesen.` : "Nichts erkannt – bitte noch einmal.";
  } catch (e) {
    state.textContent = "Spracherkennung fehlgeschlagen: " + e.message;
  }
}

$("#fields").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rec]"); if (!b) return;
  rec.active ? stopRec() : startRec(b.dataset.rec);
});
$("#fields").addEventListener("change", (e) => {
  const f = e.target.closest("[data-file]"); if (!f || !f.files[0]) return;
  transcribeInto(f.dataset.file, f.files[0]); f.value = "";
});

// ---------- Druck ----------
function printProtokoll(p) {
  const a = ART[p.art], m = minuten(p);
  $("#print").innerHTML = `
    <div class="p-head"><div class="p-praxis">${esc(PRAXIS)}</div><img src="brand/bildmarke.svg" alt="" width="36" height="27"></div>
    <h1 class="p-title">${a.titel}</h1>
    <table class="p-meta">
      <tr><th>Protokoll-Nr.</th><th>Klienten-Kürzel</th><th>Datum</th><th>Zeit (von–bis)</th><th>Dauer</th><th>Einheiten (50 Min.)</th></tr>
      <tr><td>${esc(p.nr)}</td><td>${esc(p.kuerzel)}</td><td>${datum(p.datum)}</td><td>${esc(p.beginn)}–${esc(p.ende)}</td><td>${nf2.format(stunden(m))} h</td><td>${nf1.format(einheiten(m))}</td></tr>
      <tr><th>Vorbereitung</th><td>${nf2.format((p.vorbereitungMin || 0) / 60)} h</td><th>Nachbereitung</th><td>${nf2.format((p.nachbereitungMin || 0) / 60)} h</td><th>Prozess</th><td>${p.prozessAbgeschlossen ? "abgeschlossen" : "laufend"}</td></tr>
    </table>
    ${a.felder.map(([k, label]) => `<div class="p-sec"><h3>${label}</h3><p>${esc(p.felder[k] || "–")}</p></div>`).join("")}
    ${p.supervision ? `<div class="p-sign"><div>Datum, Unterschrift Beraterin</div><div>Datum, Unterschrift und Stempel Supervision</div></div>` : ""}
    <div class="p-foot">${p.status === "abgeschlossen" ? `Abgeschlossen am ${datum(p.abgeschlossenAm.slice(0, 10))}` : "Entwurf"}${p.versionen?.length ? ` · korrigiert, ${p.versionen.length} frühere Fassung(en)` : ""} · Vertraulich (§ 119 GewO)</div>`;
  document.title = `Protokoll ${p.nr} ${p.kuerzel}`;
  window.print();
  document.title = "Protokolle · LSB Cockpit";
}
$("#print-btn").addEventListener("click", async () => { await flushSave(); readForm(); printProtokoll(aktuell); });
addEventListener("afterprint", () => { $("#print").innerHTML = ""; });

// ---------- Nachweis ----------
function nachweisRows() {
  const nur = $("#n-nur-abgeschlossen").checked;
  return filtered("n").filter((p) => !nur || p.status === "abgeschlossen").sort((a, b) => (a.datum || "").localeCompare(b.datum || "") || a.nr - b.nr);
}
function summen(rows) {
  const min = rows.reduce((s, p) => s + minuten(p), 0);
  const vn = rows.reduce((s, p) => s + (p.vorbereitungMin || 0) + (p.nachbereitungMin || 0), 0);
  return {
    anzahl: rows.length, erst: rows.filter((p) => p.art === "erst").length,
    prozesse: new Set(rows.filter((p) => p.prozessAbgeschlossen).map((p) => p.kuerzel)).size,
    klienten: new Set(rows.map((p) => p.kuerzel)).size,
    stunden: stunden(min), einheiten: einheiten(min), vn: vn / 60,
  };
}
function showNachweis() {
  const rows = nachweisRows(), s = summen(rows);
  $("#n-sums").innerHTML = [
    [s.anzahl, "Protokolle"], [nf1.format(s.einheiten), "Einheiten (50 Min.)"], [nf2.format(s.stunden), "Beratungsstunden"],
    [s.erst, "Erstgespräche"], [s.prozesse, "abgeschlossene Prozesse"], [s.klienten, "Klient:innen (Kürzel)"], [nf2.format(s.vn), "Vor-/Nachbereitung (Std.)"],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  $("#n-body").innerHTML = rows.map((p) => { const m = minuten(p); return `<tr><td>${esc(p.nr)}</td><td>${datum(p.datum)}</td><td>${esc(p.kuerzel)}</td><td>${ART[p.art].kurz}</td><td class="num">${nf2.format(stunden(m))}</td><td class="num">${nf1.format(einheiten(m))}</td><td class="num">${nf2.format(((p.vorbereitungMin || 0) + (p.nachbereitungMin || 0)) / 60)}</td></tr>`; }).join("");
  show("nachweis");
}
for (const id of ["#n-von", "#n-bis", "#n-nur-abgeschlossen"]) $(id).addEventListener("input", showNachweis);

$("#nachweis-print").addEventListener("click", () => {
  const rows = nachweisRows(), s = summen(rows);
  const von = $("#n-von").value, bis = $("#n-bis").value;
  $("#print").innerHTML = `
    <div class="p-head"><div class="p-praxis">${esc(PRAXIS)}</div><img src="brand/bildmarke.svg" alt="" width="36" height="27"></div>
    <h1 class="p-title">Nachweisliste Beratungseinheiten</h1>
    <div class="small">Zeitraum: ${von ? datum(von) : "Beginn"} bis ${bis ? datum(bis) : "heute"} · Einheit = 50 Minuten · nur Kürzel, keine Namen</div>
    <div class="p-sums"><span><b>${s.anzahl}</b> Protokolle</span><span><b>${nf1.format(s.einheiten)}</b> Einheiten</span><span><b>${nf2.format(s.stunden)}</b> Beratungsstunden</span><span><b>${s.erst}</b> Erstgespräche</span><span><b>${s.prozesse}</b> abgeschlossene Prozesse</span><span><b>${nf2.format(s.vn)}</b> Std. Vor-/Nachbereitung</span></div>
    <table class="p-list"><thead><tr><th>Nr.</th><th>Datum</th><th>Kürzel</th><th>Art</th><th class="num">Dauer (Std.)</th><th class="num">Einheiten</th><th class="num">Vor-/Nachb. (Std.)</th></tr></thead>
    <tbody>${rows.map((p) => { const m = minuten(p); return `<tr><td>${esc(p.nr)}</td><td>${datum(p.datum)}</td><td>${esc(p.kuerzel)}</td><td>${ART[p.art].kurz}</td><td class="num">${nf2.format(stunden(m))}</td><td class="num">${nf1.format(einheiten(m))}</td><td class="num">${nf2.format(((p.vorbereitungMin || 0) + (p.nachbereitungMin || 0)) / 60)}</td></tr>`; }).join("")}</tbody></table>
    <div class="p-sign"><div>Datum, Unterschrift Beraterin</div><div>Bestätigung (optional)</div></div>`;
  window.print();
});

$("#csv-btn").addEventListener("click", () => {
  const rows = nachweisRows();
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["Nr", "Datum", "Kuerzel", "Art", "Beginn", "Ende", "Dauer_Std", "Einheiten_50min", "Vorbereitung_Min", "Nachbereitung_Min", "Prozess_abgeschlossen", "Status"].join(";"),
    ...rows.map((p) => { const m = minuten(p); return [p.nr, datum(p.datum), q(p.kuerzel), ART[p.art].kurz, p.beginn, p.ende, nf2.format(stunden(m)), nf1.format(einheiten(m)), p.vorbereitungMin || 0, p.nachbereitungMin || 0, p.prozessAbgeschlossen ? "ja" : "nein", p.status].join(";"); })];
  download(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `nachweisliste-${new Date().toISOString().slice(0, 10)}.csv`);
});

function download(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Sicherung ----------
async function showSicherung() {
  const last = await store.getMeta("lastBackup");
  $("#backup-state").textContent = last ? `Letzte Sicherung: ${new Date(last).toLocaleString("de-AT")}` : "Noch keine Sicherung gespeichert.";
  let persisted = false; try { persisted = await navigator.storage?.persisted?.(); } catch { /* */ }
  $("#persist-state").textContent = persisted ? "Der Browser behandelt den Speicher als dauerhaft." : "Hinweis: Der Browser kann den Speicher bei Platzmangel oder beim Löschen der Browserdaten leeren – umso wichtiger ist die Sicherung.";
  for (const r of $$("input[name=model]")) r.checked = r.value === modelChoice();
  show("sicherung");
}
$("#backup-btn").addEventListener("click", async () => {
  const b = await store.exportBackup();
  download(new Blob([JSON.stringify(b)], { type: "application/json" }), `protokolle-sicherung-${new Date().toISOString().slice(0, 10)}.json`);
  await store.setMeta("lastBackup", now());
  toast(`Sicherung mit ${b.records.length} Protokoll(en) gespeichert (verschlüsselt).`);
  showSicherung();
});
$("#restore-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const backup = JSON.parse(await f.text());
    const pass = prompt("Passphrase der Sicherung:");
    if (!pass) return;
    const r = await store.importBackup(backup, pass);
    await loadAll();
    toast(`Eingespielt: ${r.neu} neu, ${r.aktualisiert} aktualisiert.`);
  } catch (err) { toast(err.message); }
});
$$("input[name=model]").forEach((r) => r.addEventListener("change", () => { try { localStorage.setItem("asrModel", r.value); } catch { /* */ } asrReady = false; setAsrState("Modell gewechselt – wird beim nächsten Diktat geladen."); }));

// Warnung beim Schließen mit laufender Aufnahme oder ungespeicherter Korrektur
addEventListener("beforeunload", (e) => { if (rec.active || (aktuell?._korrektur && dirty)) { e.preventDefault(); } else flushSave(); });

showLock();
