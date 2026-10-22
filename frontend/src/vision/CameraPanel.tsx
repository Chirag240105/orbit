import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/ui";
import { classifyFingerGesture, isPinching, mapLandmarkToViewport, type CursorPosition, type Point } from "./gestures";

type State = "idle" | "requesting" | "active" | "denied" | "unavailable";
export type HandGesture = "point" | "pinch" | "open" | "swipe_left" | "swipe_right";

/** Continuous tracking data for pinch-to-grab camera control. */
export type HandTrackState = {
  active: boolean;
  pinching: boolean;
  position: CursorPosition;
  /** Normalised movement since last frame, range ~-1..1 */
  delta: { x: number; y: number };
};

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export function CameraPanel({ onGesture, onHandTrack }: { onGesture: (gesture: HandGesture, position: CursorPosition) => void; onHandTrack?: (state: HandTrackState) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cursorMarker = useRef<HTMLSpanElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const landmarker = useRef<HandLandmarker | null>(null);
  const raf = useRef<number | null>(null);
  const gestureCb = useRef(onGesture);
  const trackCb = useRef(onHandTrack);
  const sampleHistory = useRef<Point[]>([]);
  const pinchStarted = useRef<number | null>(null);
  const pinchFired = useRef(false);
  const lastGestureAt = useRef(0);
  const previousCenter = useRef<{ x: number; y: number; at: number } | null>(null);
  const lastPose = useRef<"point" | "open" | null>(null);
  const controlsPaused = useRef(false);
  const frameStats = useRef({ count: 0, started: 0 });
  const lastFpsUpdate = useRef(0);
  const prevPosition = useRef<CursorPosition | null>(null);
  const [state, setState] = useState<State>("idle");
  const [tracking, setTracking] = useState("Hand tracking is off.");
  const [fps, setFps] = useState(0);
  useEffect(() => { gestureCb.current = onGesture; }, [onGesture]);
  useEffect(() => { trackCb.current = onHandTrack; }, [onHandTrack]);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    landmarker.current?.close();
    landmarker.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    sampleHistory.current = [];
    pinchStarted.current = null;
    previousCenter.current = null;
    prevPosition.current = null;
    setFps(0);
    if (cursorMarker.current) cursorMarker.current.hidden = true;
    trackCb.current?.({ active: false, pinching: false, position: { screenX: 0.5, screenY: 0.5, worldX: 0, worldY: 0 }, delta: { x: 0, y: 0 } });
    setTracking("Hand tracking is off.");
    setState("idle");
  }, []);
  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    landmarker.current?.close();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setState("unavailable");
    setState("requesting");
    try {
      const camera = await navigator.mediaDevices.getUserMedia({
        // Lower capture resolution reduces the cost of each synchronous
        // MediaPipe inference on laptops while remaining sufficient for hand landmarks.
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30, max: 30 } },
        audio: false,
      });
      stream.current = camera;
      setState("active");
      const element = video.current;
      if (!element) return;
      element.srcObject = camera;
      await element.play();
      setTracking("Loading on-device hand tracking model…");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
      } as const;
      try {
        landmarker.current = await HandLandmarker.createFromOptions(vision, options);
      } catch {
        landmarker.current = await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" } });
      }
      setTracking("Show one hand. Point to select, pinch to grab and rotate, open hand to clear, swipe to move.");
      frameStats.current = { count: 0, started: performance.now() };
      lastFpsUpdate.current = performance.now();
      const trackingStartedAt = performance.now();
      let lowFpsWindows = 0;
      let lastFrameAt = 0;
      let lastVideoTimestamp = -1;
      const process = (now: number) => {
        raf.current = requestAnimationFrame(process);
        // Throttle to ~30 FPS max; the video timestamp check prevents duplicate
        // frames.  This gives headroom above the 8 FPS stop threshold.
        if (now - lastFrameAt < 28 || !video.current || !landmarker.current || video.current.readyState < 2) return;
        lastFrameAt = now;
        const timestamp = video.current.currentTime * 1000;
        if (timestamp <= lastVideoTimestamp) return;
        lastVideoTimestamp = timestamp;
        const result = landmarker.current.detectForVideo(video.current, timestamp);
        frameStats.current.count += 1;

        // Measure inference FPS every 2 seconds to reduce React state churn.
        if (now - lastFpsUpdate.current >= 2000) {
          const elapsed = now - lastFpsUpdate.current;
          const sampledFps = Math.round(frameStats.current.count * 1000 / elapsed);
          setFps(sampledFps);
          // Model initialization and the first inference can be slow. Wait for
          // a 5-second warm-up, then require four consecutive 2-second windows
          // of consistently low FPS (8 FPS) before releasing the camera into
          // mouse/keyboard fallback.  This prevents a temporary dip from
          // terminating a usable session.
          lowFpsWindows = sampledFps < 8 ? lowFpsWindows + 1 : 0;
          if (now - trackingStartedAt >= 5000 && lowFpsWindows >= 4) {
            if (raf.current !== null) cancelAnimationFrame(raf.current);
            raf.current = null;
            landmarker.current?.close();
            landmarker.current = null;
            stream.current?.getTracks().forEach((track) => track.stop());
            stream.current = null;
            if (video.current) video.current.srcObject = null;
            trackCb.current?.({ active: false, pinching: false, position: { screenX: 0.5, screenY: 0.5, worldX: 0, worldY: 0 }, delta: { x: 0, y: 0 } });
            setState("unavailable");
            setTracking("Hand tracking was too slow for smooth interaction after a 5-second warm-up. The camera was stopped; mouse and keyboard controls are active on the same scene. You can try the camera again.");
            return;
          }
          frameStats.current = { count: 0, started: now };
          lastFpsUpdate.current = now;
        }
        const hand = result.landmarks[0];
        if (!hand) {
          if (cursorMarker.current) cursorMarker.current.hidden = true;
          sampleHistory.current = [];
          pinchStarted.current = null;
          pinchFired.current = false;
          previousCenter.current = null;
          lastPose.current = null;
          prevPosition.current = null;
          trackCb.current?.({ active: false, pinching: false, position: { screenX: 0.5, screenY: 0.5, worldX: 0, worldY: 0 }, delta: { x: 0, y: 0 } });
          return;
        }
        sampleHistory.current.push({ x: hand[9].x, y: hand[9].y });
        if (sampleHistory.current.length > 5) sampleHistory.current.shift();
        const center = sampleHistory.current.reduce((sum, point) => ({ x: sum.x + point.x / sampleHistory.current.length, y: sum.y + point.y / sampleHistory.current.length }), { x: 0, y: 0 });
        const position = mapLandmarkToViewport(center, window.innerWidth, window.innerHeight);

        // Continuous tracking for pinch-to-grab camera control.
        const pinching = isPinching(hand);
        const prev = prevPosition.current;
        const delta = prev
          ? { x: position.screenX - prev.screenX, y: position.screenY - prev.screenY }
          : { x: 0, y: 0 };
        prevPosition.current = position;
        trackCb.current?.({ active: true, pinching, position, delta });

        if (cursorMarker.current) {
          cursorMarker.current.hidden = false;
          cursorMarker.current.style.left = `${position.screenX * 100}%`;
          cursorMarker.current.style.top = `${position.screenY * 100}%`;
        }

        const prior = previousCenter.current;
        if (prior) {
          const elapsed = now - prior.at;
          if (elapsed > 500) {
            previousCenter.current = { x: center.x, y: center.y, at: now };
          } else if (elapsed >= 100) {
            const deltaX = center.x - prior.x;
            const velocityX = deltaX / (elapsed / 1000);
            if (!controlsPaused.current && Math.abs(deltaX) >= 0.16 && Math.abs(velocityX) >= 0.65 && Math.abs(center.y - prior.y) < 0.16 && now - lastGestureAt.current > 800) {
              const direction = deltaX < 0 ? "swipe_right" : "swipe_left";
              gestureCb.current(direction, position);
              setTracking("Gesture: " + direction.replace("_", " "));
              lastGestureAt.current = now;
            }
            previousCenter.current = { x: center.x, y: center.y, at: now };
          }
        } else {
          previousCenter.current = { x: center.x, y: center.y, at: now };
        }

        if (pinching) {
          lastPose.current = null;
          pinchStarted.current ??= now;
          if (!controlsPaused.current && !pinchFired.current && now - pinchStarted.current >= 300 && now - lastGestureAt.current > 800) {
            gestureCb.current("pinch", position);
            setTracking("Gesture: pinch confirmed");
            pinchFired.current = true;
            lastGestureAt.current = now;
          }
        } else {
          pinchStarted.current = null;
          pinchFired.current = false;
          const recognized = classifyFingerGesture(hand);
          if (recognized === "open") {
            if (lastPose.current !== "open" && now - lastGestureAt.current > 800) {
              controlsPaused.current = !controlsPaused.current;
              gestureCb.current("open", position);
              setTracking(controlsPaused.current ? "Gesture controls paused. Show an open hand to resume." : "Gesture controls resumed.");
              lastGestureAt.current = now;
            }
            lastPose.current = "open";
          } else if (recognized === "point") {
            if (!controlsPaused.current && now - lastGestureAt.current > 800) {
              gestureCb.current("point", position);
              setTracking("Gesture: point");
              lastGestureAt.current = now;
            }
            lastPose.current = "point";
          } else {
            lastPose.current = null;
          }
        }
      };
      raf.current = requestAnimationFrame(process);
    } catch (error) {
      if (stream.current) stream.current.getTracks().forEach((track) => track.stop());
      stream.current = null;
      if (video.current) video.current.srcObject = null;
      setState((error as DOMException).name === "NotAllowedError" ? "denied" : "unavailable");
      setTracking("Hand tracking could not start. Use the mouse and keyboard controls instead.");
    }
  };

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-md border border-line bg-black">
        <video ref={video} muted playsInline aria-label="Mirrored camera preview" className={"h-full w-full -scale-x-100 object-cover " + (state === "active" ? "" : "hidden")} />
        {state === "active" && <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 text-xs text-white"><span className="pulse-dot h-2 w-2 rounded-full bg-danger" />Camera on · {fps} FPS</span>}
        {state === "active" && <span ref={cursorMarker} aria-hidden="true" hidden className="pointer-events-none absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/50 shadow-[0_0_12px_#6c9eff]" />}
        {state === "unavailable" && fps > 0 && <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">Mouse/keyboard fallback · {fps} FPS</span>}
        {state !== "active" && <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted">
          {state === "idle" && "Camera is off. Nothing is being captured."}
          {state === "requesting" && "Waiting for your browser's permission prompt…"}
          {state === "denied" && "Camera permission was denied. Allow it in your browser's site settings, then try again."}
          {state === "unavailable" && "Camera or hand tracking is unavailable. Use mouse and keyboard controls."}
        </div>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {state === "active" ? <Button variant="danger" onClick={stop}>Stop camera</Button> : <Button disabled={state === "requesting"} onClick={start}>{state === "unavailable" || state === "denied" ? "Try camera again" : "Start camera"}</Button>}
      </div>
      <p className="mt-2 text-xs text-muted">{tracking} Video frames are processed locally and never uploaded. The hand model loads from the network; MediaPipe may send usage metrics, but not camera video.</p>
    </div>
  );
}
