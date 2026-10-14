import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui";

type State = "idle" | "requesting" | "active" | "denied" | "unavailable";

export function CameraPanel() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>("idle");

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setState("idle");
  };
  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); }, []);

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
        {state === "active" && <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 text-xs text-white"><span className="pulse-dot h-2 w-2 rounded-full bg-danger" />Camera on</span>}
        {state !== "active" && <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted">
          {state === "idle" && "Camera is off. Nothing is being captured."}
          {state === "requesting" && "Waiting for your browser's permission prompt…"}
          {state === "denied" && "Camera permission was denied. Allow it in your browser's site settings, then try again."}
          {state === "unavailable" && "No usable camera was found, or this browser blocks camera access here."}
        </div>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {state === "active" ? <Button variant="danger" onClick={stop}>Stop camera</Button> : <Button disabled={state === "requesting"} onClick={start}>Start camera</Button>}
      </div>
      <p className="mt-2 text-xs text-muted">Video stays in your browser. It isn't recorded or uploaded. ORBIT doesn't recognize objects from the camera yet, so choose a subject above.</p>
    </div>
  );
}
