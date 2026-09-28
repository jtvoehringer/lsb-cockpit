// Verschlüsselter Protokollspeicher im Browser (IndexedDB + WebCrypto).
// Passphrase → PBKDF2-SHA-256 (600.000 Iterationen) → AES-256-GCM-Schlüssel (nicht exportierbar).
// Jedes Protokoll wird einzeln verschlüsselt; die ID ist als Zusatzdaten (AAD) gebunden.
// Ohne Passphrase sind die Daten nicht lesbar – auch nicht für ICP. Passphrase verloren = Daten verloren.

const DB_NAME = "lsb-protokolle";
const ITERATIONS = 600_000;
const VERIFIER = "lsb-protokolle-v1";
const te = new TextEncoder(), td = new TextDecoder();

let key = null;

const b64 = (buf) => { let s = ""; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

let dbPromise = null;
function db() {
  dbPromise ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("meta"); r.result.createObjectStore("records", { keyPath: "id" }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbPromise;
}
async function store(name, mode = "readonly") { return (await db()).transaction(name, mode).objectStore(name); }

async function deriveKey(passphrase, salt, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey("raw", te.encode(passphrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encrypt(k, text, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode(aad) }, k, te.encode(text));
  return { iv: b64(iv), ct: b64(ct) };
}
async function decrypt(k, box, aad) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv), additionalData: te.encode(aad) }, k, unb64(box.ct));
  return td.decode(pt);
}

export async function isInitialized() { return !!(await req((await store("meta")).get("kdf"))); }
export const isUnlocked = () => key !== null;
export function lock() { key = null; }

export async function init(passphrase) {
  if (await isInitialized()) throw new Error("Speicher ist bereits eingerichtet");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const k = await deriveKey(passphrase, salt);
  const verifier = await encrypt(k, VERIFIER, "verifier");
  await req((await store("meta", "readwrite")).put({ salt: b64(salt), iterations: ITERATIONS, verifier, created: new Date().toISOString() }, "kdf"));
  key = k;
}

export async function unlock(passphrase) {
  const meta = await req((await store("meta")).get("kdf"));
  const k = await deriveKey(passphrase, unb64(meta.salt), meta.iterations);
  try { if ((await decrypt(k, meta.verifier, "verifier")) !== VERIFIER) return false; } catch { return false; }
  key = k;
  return true;
}

function need() { if (!key) throw new Error("Gesperrt – bitte Passphrase eingeben"); }

export async function list() {
  need();
  const rows = await req((await store("records")).getAll());
  const out = [];
  for (const r of rows) out.push(JSON.parse(await decrypt(key, r, "protokoll:" + r.id)));
  return out;
}

export async function save(p) {
  need();
  const box = await encrypt(key, JSON.stringify(p), "protokoll:" + p.id);
  await req((await store("records", "readwrite")).put({ id: p.id, ...box }));
}

export async function remove(id) { need(); await req((await store("records", "readwrite")).delete(id)); }

export async function getMeta(name) { return req((await store("meta")).get(name)); }
export async function setMeta(name, value) { await req((await store("meta", "readwrite")).put(value, name)); }

// Sicherung: verschlüsselt, mit eigenem Salt – nur mit der Passphrase wieder lesbar
export async function exportBackup() {
  need();
  const meta = await req((await store("meta")).get("kdf"));
  const rows = await req((await store("records")).getAll());
  return { format: "lsb-protokolle-sicherung", version: 1, created: new Date().toISOString(), kdf: { name: "PBKDF2-SHA256", salt: meta.salt, iterations: meta.iterations }, verifier: meta.verifier, records: rows };
}

// Einspielen: mit der Passphrase der Sicherung entschlüsseln, mit dem aktuellen Schlüssel neu verschlüsseln.
// Gleiche ID: die jüngere Fassung (geaendertAm) gewinnt.
export async function importBackup(backup, passphrase) {
  need();
  if (backup?.format !== "lsb-protokolle-sicherung") throw new Error("Keine Protokoll-Sicherung");
  const k = await deriveKey(passphrase, unb64(backup.kdf.salt), backup.kdf.iterations);
  try { if ((await decrypt(k, backup.verifier, "verifier")) !== VERIFIER) throw 0; } catch { throw new Error("Passphrase der Sicherung stimmt nicht"); }
  const existing = new Map((await list()).map((p) => [p.id, p]));
  let neu = 0, aktualisiert = 0;
  for (const r of backup.records) {
    const p = JSON.parse(await decrypt(k, r, "protokoll:" + r.id));
    const old = existing.get(p.id);
    if (!old) { await save(p); neu++; }
    else if ((p.geaendertAm || "") > (old.geaendertAm || "")) { await save(p); aktualisiert++; }
  }
  return { neu, aktualisiert };
}
