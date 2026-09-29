'use client'
// Diktat: Mikrofon → Ton im Arbeitsspeicher → Whisper im Hintergrund-Worker (auf dem Gerät) → Text.
// Die Tonaufnahme wird nie gespeichert und nie gesendet.

type Antwort = { type: 'text'; id: string; text: string; ms: number; geraet: string } | { type: 'fehler'; id?: string; meldung: string }
  | { type: 'fortschritt'; datei: string; geladen: number; gesamt: number } | { type: 'bereit'; modell: string; geraet: string }

let worker: Worker | null = null
const offen = new Map<string, { ok: (a: { text: string; ms: number }) => void; nein: (e: Error) => void }>()
const zuhoerer = new Set<(meldung: string) => void>()

export const modellWahl = (): 'schnell' | 'genau' => { try { return localStorage.getItem('asrModell') === 'genau' ? 'genau' : 'schnell' } catch { return 'schnell' } }
export function setzeModell(m: 'schnell' | 'genau') { try { localStorage.setItem('asrModell', m) } catch { /* */ } }
export function beiStatus(f: (meldung: string) => void) { zuhoerer.add(f); return () => { zuhoerer.delete(f) } }
const melde = (t: string) => zuhoerer.forEach((f) => f(t))

function holeWorker() {
  if (worker) return worker
  worker = new Worker('/asr/asr-worker.js', { type: 'module' })
  worker.onmessage = ({ data }: MessageEvent<Antwort>) => {
    if (data.type === 'fortschritt') melde(`Sprachmodell wird geladen (einmalig): ${data.gesamt ? Math.round((data.geladen / data.gesamt) * 100) : 0} %`)
    else if (data.type === 'bereit') melde(`Sprachmodell bereit (${data.geraet === 'webgpu' ? 'Grafikchip' : 'Prozessor'}).`)
    else if (data.type === 'text' || data.type === 'fehler') {
      const p = data.id ? offen.get(data.id) : undefined
      if (data.id) offen.delete(data.id)
      if (!p) return
      if (data.type === 'text') p.ok({ text: data.text, ms: data.ms })
      else p.nein(new Error(data.meldung))
    }
  }
  return worker
}

export function vorbereiten() { holeWorker().postMessage({ type: 'laden', modell: modellWahl() }) }

async function zuMono16k(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16000 })
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
    if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice()
    const out = new Float32Array(buf.length)
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels }
    return out
  } finally { void ctx.close() }
}

// Whisper erfindet bei Stille Text aus Untertitel-Trainingsdaten – diese Floskeln werden entfernt
const HALLUZINATION = /untertitel (im auftrag|der amara|von stephanie)|amara\.org|vielen dank für('?s)? zuschauen|bis zum nächsten mal|copyright|swr 20\d\d|zdf für funk/i

export class ZuLeise extends Error { constructor() { super('Zu leise oder zu kurz – bitte näher ans Mikrofon und noch einmal.') } }

export async function umwandeln(blob: Blob): Promise<{ text: string; ms: number }> {
  const audio = await zuMono16k(blob)
  let summe = 0
  for (let i = 0; i < audio.length; i++) summe += audio[i] * audio[i]
  if (audio.length < 8000 || Math.sqrt(summe / audio.length) < 0.004) throw new ZuLeise()
  const id = crypto.randomUUID()
  const r = await new Promise<{ text: string; ms: number }>((ok, nein) => {
    offen.set(id, { ok, nein })
    holeWorker().postMessage({ type: 'umwandeln', id, audio, modell: modellWahl() }, [audio.buffer])
  })
  return { ...r, text: r.text.split(/(?<=[.!?])\s+/).filter((s) => !HALLUZINATION.test(s)).join(' ').trim() }
}

/** Aufnahme starten; die zurückgegebene Funktion beendet sie und liefert den Ton */
export async function aufnehmen(): Promise<() => Promise<Blob>> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  const rec = new MediaRecorder(stream)
  const teile: Blob[] = []
  rec.ondataavailable = (e) => { if (e.data.size) teile.push(e.data) }
  rec.start()
  return () => new Promise<Blob>((ok) => {
    rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); ok(new Blob(teile, { type: rec.mimeType })) }
    rec.stop()
  })
}
