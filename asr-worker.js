// Spracherkennung auf dem Gerät (Whisper über transformers.js, WebGPU oder WebAssembly).
// Geladen werden nur Programm- und Modelldateien (Hugging Face, jsDelivr). Ton und Text verlassen das Gerät nicht.
import { pipeline, env } from "./vendor/transformers.min.js";

env.allowLocalModels = false;
env.useBrowserCache = true; // Modell nach dem ersten Laden aus dem Browser-Cache – danach offline nutzbar

const MODELS = {
  schnell: "onnx-community/whisper-small",
  genau: "onnx-community/whisper-large-v3-turbo",
};

let asr = null, loadedKey = null, device = null;

async function pickDevice() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    if (adapter) return { device: "webgpu", f16: adapter.features.has("shader-f16") };
  } catch { /* kein WebGPU */ }
  return { device: "wasm", f16: false };
}

async function load(modelKey) {
  if (asr && loadedKey === modelKey) return;
  const d = await pickDevice();
  device = d.device;
  const dtype = d.device === "webgpu"
    ? { encoder_model: d.f16 ? "fp16" : "fp32", decoder_model_merged: "q4" }
    : { encoder_model: "q8", decoder_model_merged: "q8" };
  asr = await pipeline("automatic-speech-recognition", MODELS[modelKey], {
    device: d.device,
    dtype,
    progress_callback: (p) => { if (p.status === "progress") self.postMessage({ type: "progress", file: p.file, loaded: p.loaded, total: p.total }); },
  });
  loadedKey = modelKey;
  self.postMessage({ type: "ready", model: modelKey, device });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      await load(data.model);
    } else if (data.type === "transcribe") {
      await load(data.model);
      const t0 = performance.now();
      const out = await asr(data.audio, { language: "german", task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
      self.postMessage({ type: "result", id: data.id, text: (out.text || "").trim(), ms: Math.round(performance.now() - t0), device });
    }
  } catch (e) {
    self.postMessage({ type: "error", id: data.id, message: String(e?.message || e) });
  }
};
