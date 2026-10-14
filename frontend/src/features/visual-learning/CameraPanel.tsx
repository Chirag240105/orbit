import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui";
import { GestureTracker, POSE_LABEL, type GestureEvent, type Pose } from "../../lib/gestures";
import { MarkerVote, detectMarkers } from "../../lib/markers";

type State = "idle" | "requesting" | "active" | "denied" | "unavailable";
const SCAN_MS = 250, SCAN_WIDTH = 480, GESTURE_MS = 66;
type GestureState = "off" | "loading" | "ready" | "missing";

/** Loads MediaPipe's hand landmarker from files served by ORBIT itself (npm run setup:vision): no CDN. */
async function loadHandLandmarker() {
  const vision = await import("@mediapipe/tasks-vision");
  const files = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const options = (delegate: "GPU" | "CPU") => ({ baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task", delegate }, runningMode: "VIDEO" as const, numHands: 1 });
  try {
    return await vision.HandLandmarker.createFromOptions(files, options("GPU"));
  } catch {
    return await vision.HandLandmarker.createFromOptions(files, options("CPU"));
  }
}

/** Camera preview with opt-in marker detection. Frames are drawn to an in-memory canvas, scanned, and dropped:
 * nothing is recorded, stored, or uploaded. */
export function CameraPanel({ knownMarker, onMarker, onGesture }: { knownMarker: (id: number) => string | undefined; onMarker: (id: number) => void; onGesture?: (e: GestureEvent) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>("idle");
  const [scan, setScan] = useState(false);
  const [seen, setSeen] = useState<number | null>(null);
  const [gestures, setGestures] = useState<GestureState>("off");
  const [pose, setPose] = useState<Pose>("none");

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setScan(false);
    setSeen(null);
    setGestures("off");
    setState("idle");
  };
  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); }, []);

  useEffect(() => {
    if (!scan || state !== "active") return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const vote = new MarkerVote(3);
    const timer = window.setInterval(() => {
      const v = video.current;
      if (!ctx || !v || v.readyState < 2 || !v.videoWidth) return;
      canvas.width = SCAN_WIDTH;
      canvas.height = Math.round((v.videoHeight / v.videoWidth) * SCAN_WIDTH);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const ids = detectMarkers(ctx.getImageData(0, 0, canvas.width, canvas.height));
      setSeen(ids.find((id) => knownMarker(id)) ?? null);
      const accepted = vote.push(ids, (id) => !!knownMarker(id));
      if (accepted !== null) onMarker(accepted);
    }, SCAN_MS);
    return () => window.clearInterval(timer);
  }, [scan, state, knownMarker, onMarker]);

  const gesturesOn = gestures !== "off" && gestures !== "missing";
  useEffect(() => {
    if (!gesturesOn || state !== "active" || !onGesture) return;
    let cancelled = false, raf = 0, last = 0, shown: Pose = "none";
    let landmarker: Awaited<ReturnType<typeof loadHandLandmarker>> | null = null;
    const tracker = new GestureTracker();
    loadHandLandmarker().then((lm) => {
      if (cancelled) { lm.close(); return; }
      landmarker = lm;
      setGestures("ready");
      const loop = (t: number) => {
        raf = requestAnimationFrame(loop);
        const v = video.current;
        if (!v || v.readyState < 2 || t - last < GESTURE_MS) return;
        last = t;
        const hand = lm.detectForVideo(v, t).landmarks?.[0] ?? null;
        const event = tracker.update(hand, t);
        if (tracker.current !== shown) { shown = tracker.current; setPose(shown); }
        if (event) onGesture(event);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => { if (!cancelled) setGestures("missing"); });
    return () => { cancelled = true; cancelAnimationFrame(raf); landmarker?.close(); setPose("none"); };
  }, [gesturesOn, state, onGesture]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setState("unavailable");
    setState("requesting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = s;
      setState("active");
      requestAnimationFrame(() => { if (video.current) { video.current.srcObject = s; void video.current.play?.(); } });
    } catch (e) {
      setState((e as DOMException).name === "NotAllowedError" ? "denied" : "unavailable");
    }
  };

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-md border border-line bg-black">
        <video ref={video} muted playsInline aria-label="Camera preview" className={`h-full w-full object-cover ${state === "active" ? "" : "hidden"}`} />
        {state === "active" && <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 text-xs text-white"><span className="pulse-dot h-2 w-2 rounded-full bg-danger" />Camera on{scan ? " · scanning for markers" : ""}{gestures === "ready" ? " · tracking hands" : ""}</span>}
        {state === "active" && seen !== null && <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">Marker #{seen}: {knownMarker(seen)}</span>}
        {state !== "active" && <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted">
          {state === "idle" && "Camera is off. Nothing is being captured."}
          {state === "requesting" && "Waiting for your browser's permission prompt…"}
          {state === "denied" && "Camera permission was denied. Allow it in your browser's site settings, then try again."}
          {state === "unavailable" && "No usable camera was found, or this browser blocks camera access here."}
        </div>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {state === "active" ? <Button variant="danger" onClick={stop}>Stop camera</Button> : <Button disabled={state === "requesting"} onClick={start}>Start camera</Button>}
        {state === "active" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={scan} onChange={(e) => { setScan(e.target.checked); setSeen(null); }} />Detect printed markers</label>}
        {state === "active" && onGesture && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={gesturesOn} onChange={(e) => setGestures(e.target.checked ? "loading" : "off")} />Gesture control</label>}
      </div>
      {gestures === "loading" && <p className="mt-2 text-xs text-muted">Loading hand tracking…</p>}
      {gestures === "missing" && <p role="alert" className="mt-2 text-xs text-warn">Hand tracking could not start. If you haven't yet, run <code className="font-mono">npm run setup:vision</code> in frontend/ (or <code className="font-mono">python scripts/dev.py</code>), then reload.</p>}
      {gestures === "ready" && (
        <div className="mt-2 rounded-md bg-raised p-2 text-xs" aria-live="polite">
          <p className="font-medium">{POSE_LABEL[pose]}</p>
          <p className="mt-1 text-muted">Pinch thumb and index, then move to rotate · two fingers up or down to zoom · hold an open palm for a second to reset.</p>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">Video stays in your browser. It isn't recorded or uploaded. ORBIT recognizes its own printed markers and hand gestures, not arbitrary objects. <Link to="/visual/markers" className="underline hover:text-text">Print the markers</Link>.</p>
    </div>
  );
}
