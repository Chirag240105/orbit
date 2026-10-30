import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/ui";
import { GestureEngine, HAND_CONNECTIONS, type GestureEvent, type HandFrame, type HandPose, type Point } from "./gestures";

export type TrackingState = "idle" | "loading" | "active" | "denied" | "unavailable";

/** Continuous hand state shared with the 3D scene through a ref, so frames never re-render React. */
export type HandTrackState = HandFrame & {
  active: boolean;
  /** Increments on every pinch tap, so the scene can react exactly once per tap. */
  tapSeq: number;
  /** Increments on every tracked camera frame, so per-frame deltas are applied once even at high refresh rates. */
  frameSeq: number;
};

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL = "/models/hand_landmarker.task";
const INACTIVE: HandTrackState = { active: false, visible: false, pose: null, pinching: false, cursor: { x: 0.5, y: 0.5 }, delta: { x: 0, y: 0 }, holdPose: null, holdProgress: 0, tapSeq: 0, frameSeq: 0 };

function drawSkeleton(canvas: HTMLCanvasElement | null, video: HTMLVideoElement, hand: Point[] | undefined, pinching: boolean) {
  if (!canvas) return;
  const w = video.videoWidth || 320;
  const h = video.videoHeight || 240;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!hand) return;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.moveTo(hand[a].x * w, hand[a].y * h);
    ctx.lineTo(hand[b].x * w, hand[b].y * h);
  }
  ctx.stroke();
  hand.forEach((p, i) => {
    const tip = i === 4 || i === 8;
    ctx.fillStyle = tip ? (pinching ? "#5fc59a" : "#6c9eff") : "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, tip ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Runs on-device MediaPipe hand tracking. Writes the smoothed hand state into
 * `trackRef` every frame and calls `onEvent` for discrete gestures.
 */
export function useHandTracking({ trackRef, onEvent }: { trackRef: React.MutableRefObject<HandTrackState | null>; onEvent: (event: GestureEvent) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const landmarker = useRef<HandLandmarker | null>(null);
  const raf = useRef<number | null>(null);
  const engine = useRef(new GestureEngine());
  const eventCb = useRef(onEvent);
  const tapSeq = useRef(0);
  const frameSeq = useRef(0);
  const [state, setState] = useState<TrackingState>("idle");
  const [message, setMessage] = useState("Hand control is off. Nothing is being captured.");
  const [fps, setFps] = useState(0);
  const [pose, setPose] = useState<HandPose | null>(null);
  const [handVisible, setHandVisible] = useState(false);
  useEffect(() => { eventCb.current = onEvent; }, [onEvent]);

  const release = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    landmarker.current?.close();
    landmarker.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    engine.current.reset();
    trackRef.current = INACTIVE;
    setFps(0); setPose(null); setHandVisible(false);
  }, [trackRef]);

  const stop = useCallback(() => {
    release();
    setState("idle");
    setMessage("Hand control is off. Nothing is being captured.");
  }, [release]);

  useEffect(() => () => release(), [release]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setState("unavailable"); setMessage("This browser can't access a camera. Mouse and keyboard controls still work."); return; }
    const element = videoRef.current;
    if (!element) { setState("unavailable"); setMessage("Open a supported scene first."); return; }
    setState("loading");
    setMessage("Waiting for camera permission…");
    try {
      // Low capture resolution keeps the synchronous per-frame inference cheap on laptops.
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30, max: 30 } }, audio: false });
      stream.current = camera;
      element.srcObject = camera;
      await element.play();
      setMessage("Loading the on-device hand model (first time only, about 20 MB)…");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = { baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" }, runningMode: "VIDEO", numHands: 1, minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.55, minTrackingConfidence: 0.5 } as const;
      try {
        landmarker.current = await HandLandmarker.createFromOptions(vision, options);
      } catch {
        landmarker.current = await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" } });
      }
      if (!stream.current) return; // stopped while loading
      setState("active");
      setMessage("Tracking on this device. Video never leaves your browser.");

      let frames = 0;
      let windowStart = performance.now();
      const startedAt = windowStart;
      let lowWindows = 0;
      let lastFrameAt = 0;
      let lastVideoTime = -1;
      let lastPose: HandPose | null = null;
      let lastVisible = false;
      const process = (now: number) => {
        raf.current = requestAnimationFrame(process);
        const video = videoRef.current;
        if (now - lastFrameAt < 28 || !video || !landmarker.current || video.readyState < 2) return;
        lastFrameAt = now;
        const timestamp = video.currentTime * 1000;
        if (timestamp <= lastVideoTime) return;
        lastVideoTime = timestamp;
        const result = landmarker.current.detectForVideo(video, timestamp);
        frames += 1;

        if (now - windowStart >= 2000) {
          const sampled = Math.round((frames * 1000) / (now - windowStart));
          setFps(sampled);
          // After a warm-up, stop only if tracking stays unusably slow for 8 seconds.
          lowWindows = sampled < 6 ? lowWindows + 1 : 0;
          if (now - startedAt >= 5000 && lowWindows >= 4) {
            release();
            setState("unavailable");
            setMessage("Hand tracking was too slow on this device, so the camera was stopped. Mouse and keyboard controls still work; you can try again.");
            return;
          }
          frames = 0;
          windowStart = now;
        }

        const hand = result.landmarks[0] as Point[] | undefined;
        const { frame, events } = engine.current.update(hand ?? null, now);
        for (const event of events) if (event.type === "tap") tapSeq.current += 1;
        frameSeq.current += 1;
        trackRef.current = { ...frame, active: true, tapSeq: tapSeq.current, frameSeq: frameSeq.current };
        drawSkeleton(overlayRef.current, video, hand, frame.pinching);
        if (frame.pose !== lastPose) { lastPose = frame.pose; setPose(frame.pose); }
        if (frame.visible !== lastVisible) { lastVisible = frame.visible; setHandVisible(frame.visible); }
        for (const event of events) if (event.type !== "tap") eventCb.current(event);
      };
      raf.current = requestAnimationFrame(process);
    } catch (error) {
      release();
      const denied = (error as DOMException)?.name === "NotAllowedError";
      setState(denied ? "denied" : "unavailable");
      setMessage(denied ? "Camera permission was denied. Allow it in your browser's site settings, then try again." : "Hand tracking could not start (no camera found, or the model could not download). Mouse and keyboard controls still work.");
    }
  };

  return { videoRef, overlayRef, state, message, fps, pose, handVisible, start, stop };
}

export type HandTracking = ReturnType<typeof useHandTracking>;

const POSE_LABEL: Record<HandPose, string> = { point: "Pointing", open: "Open palm", pinch: "Pinch", thumbs_up: "Thumbs up", fist: "Fist" };

/** Mirrored camera preview with the tracked hand skeleton, shown inside the 3D stage. */
export function HandPreview({ tracking }: { tracking: HandTracking }) {
  const on = tracking.state === "active" || tracking.state === "loading";
  return (
    <div className={`scene-chip absolute bottom-3 right-3 z-30 w-40 overflow-hidden rounded-lg sm:w-48 ${on ? "" : "hidden"}`} aria-label="Camera preview">
      <div className="relative aspect-[4/3] bg-black">
        <video ref={tracking.videoRef} muted playsInline aria-label="Mirrored camera preview" className="h-full w-full -scale-x-100 object-cover" />
        <canvas ref={tracking.overlayRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100" />
        {tracking.state === "loading" && <div className="absolute inset-0 grid place-items-center bg-black/60 p-2 text-center text-[11px] text-muted">Starting…</div>}
        {tracking.state === "active" && !tracking.handVisible && <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-center text-[11px] text-text">Show one hand</div>}
      </div>
      <div className="flex items-center justify-between gap-2 px-2 py-1 text-[11px]">
        <span className="flex items-center gap-1.5"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-danger" />{tracking.pose ? POSE_LABEL[tracking.pose] : "No hand"}</span>
        <span className="font-mono text-muted">{tracking.fps} fps</span>
      </div>
    </div>
  );
}

const GUIDE: { pose: HandPose | "swipe"; icon: string; title: string; detail: string }[] = [
  { pose: "point", icon: "☝️", title: "Point and hold", detail: "Aim at a part and hold for a moment to select it." },
  { pose: "pinch", icon: "🤏", title: "Pinch and drag", detail: "Grab the scene to rotate it. A quick pinch selects the part under the cursor." },
  { pose: "swipe", icon: "👋", title: "Swipe left or right", detail: "Move to the previous or next part, or step through the tour." },
  { pose: "open", icon: "✋", title: "Hold an open palm", detail: "Reset the view and clear the selection." },
  { pose: "thumbs_up", icon: "👍", title: "Hold a thumbs up", detail: "Remember the selected part in Memory." },
];

/** Sidebar panel: start/stop control, live status, and the gesture reference. */
export function GestureGuide({ tracking, status }: { tracking: HandTracking; status?: string }) {
  const running = tracking.state === "active" || tracking.state === "loading";
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{tracking.message}</p>
        {running
          ? <Button variant="danger" onClick={tracking.stop}>Stop</Button>
          : <Button variant="primary" onClick={() => void tracking.start()}>{tracking.state === "idle" ? "Start" : "Try again"}</Button>}
      </div>
      <ul className="mt-3 space-y-1">
        {GUIDE.map((g) => {
          const live = tracking.state === "active" && tracking.pose === g.pose;
          return (
            <li key={g.pose} className={`flex gap-2.5 rounded-md px-2 py-1.5 transition-colors ${live ? "bg-accent/15" : ""}`}>
              <span aria-hidden className="text-base leading-5">{g.icon}</span>
              <span className="min-w-0">
                <span className={`block text-sm ${live ? "text-accent" : ""}`}>{g.title}</span>
                <span className="block text-xs text-muted">{g.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {status && <p role="status" className="mt-2 text-xs text-muted">{status}</p>}
      <p className="mt-2 text-[11px] text-muted/80">Frames are processed locally and never uploaded. The hand landmarker model is served locally. Frames are processed in-browser and never uploaded.</p>
    </div>
  );
}
