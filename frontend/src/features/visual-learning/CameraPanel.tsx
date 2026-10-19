import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui";
import { classifyFingerGesture, isPinching, type Point } from "./gestures";

type State = "idle" | "requesting" | "active" | "denied" | "unavailable";
export type HandGesture = "point" | "pinch" | "open" | "swipe_left" | "swipe_right";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export function CameraPanel({ onGesture }: { onGesture: (gesture: HandGesture, x: number) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const landmarker = useRef<HandLandmarker | null>(null);
  const raf = useRef<number | null>(null);
  const callback = useRef(onGesture);
  const sampleHistory = useRef<Point[]>([]);
  const pinchStarted = useRef<number | null>(null);
  const pinchFired = useRef(false);
  const lastGestureAt = useRef(0);
  const previousCenter = useRef<{ x: number; at: number } | null>(null);
  const frameStats = useRef({ count: 0, started: 0 });
  const [state, setState] = useState<State>("idle");
  const [tracking, setTracking] = useState("Hand tracking is off.");
  const [fps, setFps] = useState(0);
  useEffect(() => { callback.current = onGesture; }, [onGesture]);

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
    setFps(0);
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
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
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
      setTracking("Show one hand. Point to select, pinch to remember, open hand to clear, swipe to move.");
      frameStats.current = { count: 0, started: performance.now() };
      let lastFrameAt = 0;
      let lastVideoTimestamp = -1;
      const process = (now: number) => {
        raf.current = requestAnimationFrame(process);
        if (now - lastFrameAt < 50 || !video.current || !landmarker.current || video.current.readyState < 2) return;
        lastFrameAt = now;
        const timestamp = video.current.currentTime * 1000;
        if (timestamp <= lastVideoTimestamp) return;
        lastVideoTimestamp = timestamp;
        const result = landmarker.current.detectForVideo(video.current, timestamp);
        frameStats.current.count += 1;
        if (now - frameStats.current.started >= 1000) {
          setFps(Math.round(frameStats.current.count * 1000 / (now - frameStats.current.started)));
          frameStats.current = { count: 0, started: now };
        }
        const hand = result.landmarks[0];
        if (!hand) {
          sampleHistory.current = [];
          pinchStarted.current = null;
          pinchFired.current = false;
          previousCenter.current = null;
          return;
        }
        sampleHistory.current.push({ x: hand[9].x, y: hand[9].y });
        if (sampleHistory.current.length > 5) sampleHistory.current.shift();
        const center = sampleHistory.current.reduce((sum, point) => ({ x: sum.x + point.x / sampleHistory.current.length, y: sum.y + point.y / sampleHistory.current.length }), { x: 0, y: 0 });

        const prior = previousCenter.current;
        if (prior && now - prior.at <= 500 && now - prior.at >= 120 && Math.abs(center.y - hand[9].y) < 0.16 && center.x - prior.x > 0.24 && now - lastGestureAt.current > 800) {
          callback.current("swipe_right", center.x);
          lastGestureAt.current = now;
        } else if (prior && now - prior.at <= 500 && now - prior.at >= 120 && Math.abs(center.y - hand[9].y) < 0.16 && prior.x - center.x > 0.24 && now - lastGestureAt.current > 800) {
          callback.current("swipe_left", center.x);
          lastGestureAt.current = now;
        }
        previousCenter.current = { x: center.x, at: now };

        const pinch = isPinching(hand);
        if (pinch) {
          pinchStarted.current ??= now;
          if (!pinchFired.current && now - pinchStarted.current >= 300 && now - lastGestureAt.current > 800) {
            callback.current("pinch", center.x);
            pinchFired.current = true;
            lastGestureAt.current = now;
          }
        } else {
          pinchStarted.current = null;
          pinchFired.current = false;
          const recognized = classifyFingerGesture(hand);
          if (recognized && now - lastGestureAt.current > 800) {
            callback.current(recognized, center.x);
            lastGestureAt.current = now;
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
        <video ref={video} muted playsInline aria-label="Camera preview" className={"h-full w-full object-cover " + (state === "active" ? "" : "hidden")} />
        {state === "active" && <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 text-xs text-white"><span className="pulse-dot h-2 w-2 rounded-full bg-danger" />Camera on · {fps} FPS</span>}
        {state !== "active" && <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted">
          {state === "idle" && "Camera is off. Nothing is being captured."}
          {state === "requesting" && "Waiting for your browser's permission prompt…"}
          {state === "denied" && "Camera permission was denied. Allow it in your browser's site settings, then try again."}
          {state === "unavailable" && "Camera or hand tracking is unavailable. Use mouse and keyboard controls."}
        </div>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {state === "active" ? <Button variant="danger" onClick={stop}>Stop camera</Button> : <Button disabled={state === "requesting"} onClick={start}>Start camera</Button>}
      </div>
      <p className="mt-2 text-xs text-muted">{tracking} Video frames are processed locally and never uploaded. The hand model loads from the network; MediaPipe may send usage metrics, but not camera video.</p>
    </div>
  );
}
