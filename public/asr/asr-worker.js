// Spracherkennung auf dem Gerät (Whisper über transformers.js 4.3.0, WebGPU oder WebAssembly).
// Aus dem Netz kommen nur Programm- und Modelldateien (Hugging Face, jsDelivr) – Ton und Text verlassen das Gerät nie.
// Eigene Content-Security-Policy: next.config.ts, Pfad /asr/.
import { pipeline, env } from './transformers.min.js'

env.allowLocalModels = false
env.useBrowserCache = true

const MODELLE = { schnell: 'onnx-community/whisper-small', genau: 'onnx-community/whisper-large-v3-turbo' }
let asr = null, geladen = null, geraet = null

async function waehleGeraet() {
  try {
    const a = await navigator.gpu?.requestAdapter()
    if (a) return { device: 'webgpu', f16: a.features.has('shader-f16') }
  } catch { /* kein WebGPU */ }
  return { device: 'wasm', f16: false }
}

async function laden(modell) {
  if (asr && geladen === modell) return
  const g = await waehleGeraet()
  geraet = g.device
  const dtype = g.device === 'webgpu' ? { encoder_model: g.f16 ? 'fp16' : 'fp32', decoder_model_merged: 'q4' } : { encoder_model: 'q8', decoder_model_merged: 'q8' }
  asr = await pipeline('automatic-speech-recognition', MODELLE[modell] ?? MODELLE.schnell, {
    device: g.device, dtype,
    progress_callback: (p) => { if (p.status === 'progress') self.postMessage({ type: 'fortschritt', datei: p.file, geladen: p.loaded, gesamt: p.total }) },
  })
  geladen = modell
  self.postMessage({ type: 'bereit', modell, geraet })
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'laden') await laden(data.modell)
    else if (data.type === 'umwandeln') {
      await laden(data.modell)
      const t0 = performance.now()
      const out = await asr(data.audio, { language: 'german', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 })
      self.postMessage({ type: 'text', id: data.id, text: (out.text || '').trim(), ms: Math.round(performance.now() - t0), geraet })
    }
  } catch (e) {
    self.postMessage({ type: 'fehler', id: data.id, meldung: String(e?.message || e) })
  }
}
