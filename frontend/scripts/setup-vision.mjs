// Installs what gesture control (CV-02) needs into public/mediapipe/ so it runs offline:
// the MediaPipe WebAssembly runtime (copied from node_modules) and the hand-landmark model (downloaded once).
//   npm run setup:vision
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "mediapipe");
const WASM_SRC = join(ROOT, "node_modules", "@mediapipe", "tasks-vision", "wasm");
// Google's published hand landmarker (Apache-2.0), version 1, float16.
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MODEL = join(OUT, "hand_landmarker.task");

mkdirSync(join(OUT, "wasm"), { recursive: true });
for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  if (!existsSync(join(WASM_SRC, f))) throw new Error(`Missing ${f}: run npm install first.`);
  copyFileSync(join(WASM_SRC, f), join(OUT, "wasm", f));
}
console.log("MediaPipe runtime copied to public/mediapipe/wasm");

if (existsSync(MODEL) && statSync(MODEL).size > 1_000_000) {
  console.log("Hand model already present.");
} else {
  console.log(`Downloading the hand model from ${MODEL_URL} …`);
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Download failed (${res.status}). Check your connection and run npm run setup:vision again.`);
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length < 1_000_000) throw new Error("The downloaded model is unexpectedly small; not saved.");
  mkdirSync(dirname(MODEL), { recursive: true });
  writeFileSync(MODEL, data);
  console.log(`Saved ${(data.length / 1e6).toFixed(1)} MB to public/mediapipe/hand_landmarker.task`);
}
