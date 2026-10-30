import { useSearchParams, useLocation } from "react-router-dom";
import { Search, MessageSquareText, Github } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, PageHeader, Panel, inputCls } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { GestureGuide, HandPreview, useHandTracking, type HandTrackState } from "./CameraPanel";
import { SceneCanvas } from "./SceneCanvas";
import { sceneFromGenerated } from "./layout";
import { createTopicScene, kindLabels, kindOf, matchCuratedSubject, stepsOf, subjects, type Scene } from "./scenes";
import { FloatingExplainChat, type ComponentContext } from "./ExplainDrawer";

const SUGGESTIONS = ["Uber", "Netflix", "WhatsApp", "Zomato", "Spotify", "Slack", "Kubernetes", "Stock exchange"];
const GENERATION_STEPS = ["Identifying the core components", "Mapping how requests and data flow", "Writing explanations, failure modes and scaling notes", "Laying out the 3D scene"];

/** Shown over the stage while the model designs a system; cycles through what it is doing. */
function GeneratingOverlay({ topic }: { topic: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => window.clearInterval(timer);
  }, []);
  const step = Math.min(GENERATION_STEPS.length - 1, Math.floor(elapsed / 5));
  return (
    <div role="status" className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-bg/80 p-6 text-center backdrop-blur-sm">
      <span className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
        <span className="h-4 w-4 rounded-full bg-accent shadow-[0_0_24px_var(--color-accent)]" />
      </span>
      <div>
        <p className="text-base font-semibold">Designing “{topic}”</p>
        <p className="mt-1 text-sm text-muted">{GENERATION_STEPS[step]}…</p>
      </div>
      <ol className="flex gap-1.5" aria-hidden>
        {GENERATION_STEPS.map((s, i) => <li key={s} className={`h-1 w-10 rounded-full transition-colors ${i <= step ? "bg-accent" : "bg-line"}`} />)}
      </ol>
      <p className="text-xs text-muted">{Math.round(elapsed)}s · usually 15–25 seconds</p>
    </div>
  );
}
import type { GestureEvent } from "./gestures";

function Detail({ label, tone, children }: { label: string; tone: string; children: ReactNode }) {
  return (
    <div className="border-l-2 pl-3" style={{ borderColor: tone }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-1 text-xs leading-relaxed text-text/90">{children}</div>
    </div>
  );
}

function useFullscreen(target: React.RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const update = () => setActive(document.fullscreenElement === target.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, [target]);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void target.current?.requestFullscreen?.().catch(() => undefined);
  };
  return { active, toggle, supported: typeof document !== "undefined" && !!document.fullscreenEnabled };
}

// ---------------------------------------------------------------------------
// GitHub repo import widget
// ---------------------------------------------------------------------------

function GitHubImport({
  onScene,
  onGenerated,
}: {
  onScene: (scene: Scene) => void;
  onGenerated: (model: string, cached: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);

  const importMut = useMutation({
    mutationFn: (u: string) => api.generateSceneFromGithub(u),
    onSuccess: (res, u) => {
      const repoName = u.replace("https://github.com/", "").split("/tree/")[0];
      onScene(sceneFromGenerated(repoName, res.scene));
      onGenerated(res.model, res.cached);
      setUrl("");
    },
  });

  if (!open) {
    return (
      <div className="-mt-2 mb-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors"
        >
          <Github size={13} />
          Import from GitHub repo
        </button>
      </div>
    );
  }

  return (
    <div className="-mt-2 mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex-1 min-w-56">
        <label htmlFor="github-repo-url" className="mb-1 block text-xs text-muted">
          Public GitHub repo URL
        </label>
        <input
          id="github-repo-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className={`${inputCls} text-sm`}
          disabled={importMut.isPending}
        />
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          variant="primary"
          disabled={!url.trim() || importMut.isPending}
          onClick={() => importMut.mutate(url.trim())}
        >
          {importMut.isPending ? "Generating…" : "✦ Visualize"}
        </Button>
        <Button onClick={() => { setOpen(false); importMut.reset(); }}>Cancel</Button>
      </div>
      {importMut.error && (
        <p className="w-full text-xs text-danger">
          {importMut.error instanceof ApiError ? importMut.error.message : "Failed to generate scene."}
        </p>
      )}
      <p className="w-full text-[10px] text-muted">
        Public repos only · max 25 MB · results are model-assisted and may contain mistakes
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VisualLearningPage
// ---------------------------------------------------------------------------

export function VisualLearningPage() {
  const qc = useQueryClient();
  const location = useLocation();
  const [subjectId, setSubjectId] = useState(subjects[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [learning, setLearning] = useState<number | null>(null);
  const [gestureStatus, setGestureStatus] = useState("");
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [topic, setTopic] = useState("");
  const [customScene, setCustomScene] = useState<Scene | null>(null);
  const [generated, setGenerated] = useState<{ model: string; cached: boolean } | null>(null);
  const [genNotice, setGenNotice] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  // explainCtx: the part that was selected when Explain was *clicked* — never changes on gesture/hover.
  const [explainCtx, setExplainCtx] = useState<ComponentContext | null>(null);
  // Use a ref for hand tracking to avoid re-rendering on every inference frame.
  const handTrackRef = useRef<HandTrackState | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const handCursor = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(stage);
  const subject = customScene
    ? { id: customScene.id, title: customScene.title, supported: true, scene: customScene }
    : subjects.find((s) => s.id === subjectId)!;
  const scene = customScene ?? subject.scene;
  const steps = scene ? stepsOf(scene) : [];
  const sel = scene?.components.find((c) => c.id === selected);
  const byId = Object.fromEntries((scene?.components ?? []).map((c) => [c.id, c]));
  const incoming = sel ? (scene?.components ?? []).filter((c) => c.connectsTo.includes(sel.id)) : [];
  const flowCount = (scene?.components ?? []).reduce((n, c) => n + c.connectsTo.length, 0);
  const goStep = (i: number) => { setLearning(i); setSelected(steps[i].id); setIsolated(null); };
  const choose = (id: string) => { setSelected(id); setLearning(null); };
  const remember = useMutation({
    mutationFn: (content: string) => api.saveVisionContext({ content, project_name: subject.title }),
    onSuccess: () => { setGestureStatus("Saved as a confirmed VISION memory linked to " + subject.title + "."); qc.invalidateQueries({ queryKey: ["memories"] }); },
    onError: () => setGestureStatus("Could not save the visual memory."),
  });
  const flash = (text: string) => { setToast({ id: Date.now(), text }); setGestureStatus(text); };
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const handleHandEvent = (event: GestureEvent) => {
    if (!scene || !steps.length) return;
    if (event.type === "swipe") {
      const dir = event.direction === "right" ? 1 : -1;
      if (learning !== null) {
        const next = Math.min(steps.length - 1, Math.max(0, learning + dir));
        goStep(next);
        flash(`Swipe ${event.direction} · Step ${next + 1}: ${steps[next].label}`);
      } else {
        const current = steps.findIndex((c) => c.id === selected);
        const next = current < 0 ? (dir > 0 ? 0 : steps.length - 1) : (current + dir + steps.length) % steps.length;
        choose(steps[next].id);
        flash(`Swipe ${event.direction} · ${steps[next].label}`);
      }
    } else if (event.type === "hold" && event.pose === "open") {
      setResetKey((k) => k + 1); setSelected(null); setIsolated(null); setLearning(null);
      flash("Open palm · View reset");
    } else if (event.type === "hold" && event.pose === "thumbs_up") {
      if (!sel) { flash("Select a part first, then hold a thumbs up to remember it"); return; }
      remember.mutate("Remembered with a gesture in Visual Learning: " + subject.title + " — " + sel.label + ". " + sel.summary);
      flash(`Thumbs up · Remembering ${sel.label}`);
    }
  };
  const tracking = useHandTracking({ trackRef: handTrackRef, onEvent: handleHandEvent });
  const handOn = tracking.state === "active" || tracking.state === "loading";
  // The preview video lives in the 3D stage, so tracking stops when a subject has no scene.
  useEffect(() => { if (!scene && handOn) tracking.stop(); }, [scene, handOn, tracking]);
  const handSelect = (id: string, via: "dwell" | "tap") => {
    // While touring, hand selection follows the tour instead of leaving it.
    const stepIndex = steps.findIndex((c) => c.id === id);
    if (learning !== null && stepIndex >= 0) goStep(stepIndex); else choose(id);
    flash(`${via === "tap" ? "Pinch" : "Point"} · ${byId[id]?.label ?? "Part"} selected`);
  };

  // The canvas stays mounted across scene changes, so only a fresh mount (from an unsupported subject) waits for onReady again.
  const pickSubject = (id: string) => { setCustomScene(null); setSubjectId(id); setSelected(null); setIsolated(null); setLearning(null); if (!scene) setReady(false); };
  const showCustom = (next: Scene) => {
    setCustomScene(next); setSelected(null); setIsolated(null); setLearning(null); if (!scene) setReady(false); setResetKey((key) => key + 1);
  };
  const generate = useMutation({
    mutationFn: (t: string) => api.generateScene(t),
    onSuccess: (res, t) => {
      showCustom(sceneFromGenerated(t, res.scene));
      setGenerated({ model: res.model, cached: res.cached });
      setGenNotice("");
    },
    onError: (error, t) => {
      // Without a model, or if generation fails, still show something useful.
      showCustom(createTopicScene(t));
      setGenerated(null);
      const code = error instanceof ApiError ? error.code : "";
      setGenNotice(code === "scene_generation_unavailable"
        ? "Connect a model (for example an NVIDIA API key) to generate full systems. Showing a starter map."
        : `Couldn't generate “${t}”: ${error instanceof Error ? error.message : "unknown error"} Showing a starter map; try again.`);
    },
  });
  const searchSystem = (raw: string) => {
    const t = raw.trim();
    if (!t || generate.isPending) return;
    setTopic(t);
    setGenNotice("");
    // Hand-built scenes open instantly; anything else is designed by the model.
    const curated = matchCuratedSubject(t);
    if (curated) { setGenerated(null); pickSubject(curated); setResetKey((key) => key + 1); return; }
    generate.mutate(t);
  };
  const buildTopic = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); searchSystem(topic); };
  // A search started elsewhere (Home) arrives as ?q=; run it once, then clear it from the URL.
  const [params, setParams] = useSearchParams();
  const queryTopic = params.get("q");
  useEffect(() => {
    if (!queryTopic) return;
    setParams({}, { replace: true });
    searchSystem(queryTopic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTopic]);

  // Handle navigation from Projects page with a pre-generated scene
  const navState = location.state as { generatedScene?: import("../types/api").SceneResponse } | null;
  useEffect(() => {
    if (!navState?.generatedScene) return;
    const res = navState.generatedScene;
    const repoName = res.provider.replace(/^(github:|local:)/, "").split("/").pop() ?? "repo";
    showCustom(sceneFromGenerated(repoName, res.scene));
    setGenerated({ model: res.model, cached: res.cached });
    // Clear the state so navigating away and back doesn't re-trigger
    window.history.replaceState({}, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader title="Visual Learning Studio" description="Search any system to explore its architecture in 3D, then follow a request through it, part by part." />
      <form onSubmit={buildTopic} className="flex flex-wrap gap-2" aria-label="Search any system">
        <label className="sr-only" htmlFor="learning-topic">Which system do you want to explore?</label>
        <div className="relative min-w-60 flex-1">
          <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input id="learning-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={80} placeholder="Search any system: Uber, Netflix, WhatsApp, Zomato, a stock exchange…" className="w-full rounded-xl border border-line bg-surface py-3 pl-11 pr-4 text-[0.95rem] placeholder:text-muted/80 focus:border-accent" />
        </div>
        <Button variant="primary" className="rounded-xl px-5" disabled={!topic.trim() || generate.isPending}>{generate.isPending ? "Designing…" : "Explore system"}</Button>
      </form>
      <div className="mb-4 mt-3 space-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Built-in systems">
          <span className="w-16 shrink-0 text-muted">Built-in</span>
          {subjects.map((s) => (
            <button key={s.id} role="tab" aria-selected={!customScene && s.id === subjectId} title={s.title} onClick={() => { setGenerated(null); pickSubject(s.id); }} className={`rounded-full border px-3 py-1 font-medium transition-colors ${!customScene && s.id === subjectId ? "border-accent bg-accent-soft text-text" : "border-line text-muted hover:border-muted hover:text-text"}`}>
              {s.shortTitle ?? s.title}{!s.supported && " · planned"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-muted">Generate</span>
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" disabled={generate.isPending} onClick={() => searchSystem(s)} className={`rounded-full border px-3 py-1 transition-colors disabled:opacity-40 ${customScene && generate.variables === s ? "border-nebula bg-nebula/15 text-text" : "border-line text-muted hover:border-muted hover:text-text"}`}>{s}</button>
          ))}
        </div>
      </div>
      {genNotice && <p role="status" className="-mt-2 mb-3 text-xs text-warn">{genNotice}</p>}
      {/* GitHub repo URL input */}
      <GitHubImport onScene={showCustom} onGenerated={(m, c) => { setGenerated({ model: m, cached: c }); setGenNotice(""); }} />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-4">
          {!scene ? (
            <EmptyState title={`${subject.title} isn't supported yet`}>{subject.note} Add a scene in <code className="font-mono">vision/scenes.ts</code>.</EmptyState>
          ) : (
            <div ref={stage} className="scene-stage relative h-[28rem] overflow-hidden rounded-xl border border-line md:h-[36rem]">
              {generate.isPending && <GeneratingOverlay topic={generate.variables ?? topic} />}
              {!ready && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-bg text-sm text-muted">
                  <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-accent" />Building the 3D scene…
                </div>
              )}
              <SceneCanvas scene={scene} selectedId={selected} isolatedId={isolated} resetKey={resetKey} handTrackRef={handTrackRef} handCursorRef={handCursor} onSelect={choose} onHandSelect={handSelect} onClear={() => { if (learning === null) setSelected(null); }} onReady={() => setReady(true)} />
              <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start justify-between gap-2">
                <div className="scene-chip min-w-0 rounded-lg px-3 py-2">
                  <p className="truncate text-sm font-semibold">{scene.title}</p>
                  <p className="truncate text-[11px] text-muted">
                    {scene.components.length} parts · {flowCount} data flows
                    {customScene && generated && <> · <span className="text-accent">✦ Designed by {generated.model}{generated.cached ? " (cached)" : ""}</span></>}
                  </p>
                </div>
                <div className="pointer-events-auto flex shrink-0 items-center gap-2">
                  <span className="scene-chip hidden rounded-md px-2 py-1 text-[11px] text-muted 2xl:inline">Drag to orbit · Scroll to zoom · Click a part</span>
                  <Button className="scene-chip" onClick={() => (handOn ? tracking.stop() : void tracking.start())} aria-pressed={handOn}>{handOn ? "Stop hand control" : "✋ Hand control"}</Button>
                  {fullscreen.supported && <Button className="scene-chip" onClick={fullscreen.toggle} aria-pressed={fullscreen.active}>{fullscreen.active ? "Exit full screen" : "Full screen"}</Button>}
                </div>
              </div>
              <div className="absolute bottom-3 left-3 z-30 flex gap-2">
                <Button className="scene-chip" onClick={() => { setResetKey((k) => k + 1); setSelected(null); setIsolated(null); setLearning(null); }}>Reset view</Button>
                {isolated && <Button className="scene-chip" onClick={() => setIsolated(null)}>Show all parts</Button>}
                {learning === null && <Button variant="primary" onClick={() => goStep(0)}>Start tour</Button>}
              </div>
              <div ref={handCursor} hidden aria-hidden className="hand-cursor" />
              <HandPreview tracking={tracking} />
              {toast && <div key={toast.id} role="status" className="gesture-toast scene-chip absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-full px-3 py-1.5 text-xs font-medium">{toast.text}</div>}
              {tracking.state === "active" && learning === null && (
                <div className="scene-chip pointer-events-none absolute bottom-14 left-3 z-30 hidden rounded-md px-2 py-1 text-[11px] text-muted md:block">☝️ Point &amp; hold to select · 🤏 Pinch &amp; drag to rotate · 👋 Swipe to step · ✋ Hold palm to reset · 👍 Remember</div>
              )}
              {learning !== null && (
                <div className="scene-hud scene-chip absolute bottom-3 left-1/2 z-30 w-[min(30rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl p-3" role="region" aria-label="Guided tour">
                  <div className="flex items-center gap-1" aria-hidden>
                    {steps.map((st, i) => <span key={st.id} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i <= learning ? st.color : "var(--color-line)" }} />)}
                  </div>
                  <div className="mt-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted">Step {learning + 1} of {steps.length} · {kindLabels[kindOf(steps[learning])]}</p>
                      <p className="truncate text-sm font-semibold">{steps[learning].label}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{steps[learning].summary}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button disabled={learning === 0} onClick={() => goStep(learning - 1)} aria-label="Previous step">←</Button>
                      {learning === steps.length - 1
                        ? <Button variant="primary" onClick={() => setLearning(null)}>Finish</Button>
                        : <Button variant="primary" onClick={() => goStep(learning + 1)} aria-label="Next step">→</Button>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {scene && <p className="-mt-2 text-xs text-muted">{scene.description} Glowing packets show the direction data flows.</p>}
          {scene && (
            <Panel title={`Parts · ${scene.components.length}`}>
              {/* A dense multi-column index under the stage; selecting a part fills the pinned explanation. */}
              <ul className="grid gap-x-3 gap-y-0.5 sm:grid-cols-2 xl:grid-cols-3">{scene.components.map((c) => (
                <li key={c.id} className="min-w-0">
                  <button onClick={() => choose(c.id)} aria-pressed={selected === c.id} className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-raised ${selected === c.id ? "bg-raised font-medium" : ""}`}>
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold text-night" style={{ background: c.color }}>{c.step}</span>
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    <span className="shrink-0 text-[11px] text-muted">{kindLabels[kindOf(c)]}</span>
                  </button>
                </li>
              ))}</ul>
            </Panel>
          )}
          {scene?.overview && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Requirements">
                <ul className="list-disc space-y-1 pl-5 text-sm">{scene.overview.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
                {scene.overview.assumptions.length > 0 && <>
                  <h3 className="mt-4 text-xs font-semibold text-muted">Assumptions</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{scene.overview.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </>}
              </Panel>
              <Panel title="Architecture and request flow">
                <p className="text-sm leading-relaxed">{scene.overview.architecture}</p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">{scene.overview.requestFlow.map((step, i) => <li key={i}>{step}</li>)}</ol>
              </Panel>
            </div>
          )}
        </div>
        {/* Pinned beside the stage so details stay in view while the parts and overview scroll. */}
        <div className="space-y-4 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-7.5rem)] lg:self-start lg:overflow-y-auto lg:pb-1">
          <Panel title="Explanation">
            {sel ? (
              <div>
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-xs font-semibold text-night" style={{ background: sel.color, boxShadow: `0 0 20px ${sel.color}55` }}>{sel.step}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{kindLabels[kindOf(sel)]} · {{ vpc: "Private network", gpu: "GPU cluster", internet: "Public internet" }[sel.zone]}</p>
                    <h3 className="font-semibold">{sel.label}</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm">{sel.summary}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{sel.details}</p>
                <div className="mt-4 space-y-3">
                  {sel.apis && <Detail label="APIs" tone="var(--color-accent)"><span className="font-mono">{sel.apis}</span></Detail>}
                  {sel.dataModel && <Detail label="Data model" tone="#c792ea">{sel.dataModel}</Detail>}
                  {sel.scaling && <Detail label="Scaling" tone="var(--color-ok)">{sel.scaling}</Detail>}
                  {sel.failureMode && <Detail label="What can go wrong" tone="var(--color-danger)">{sel.failureMode}</Detail>}
                  {sel.tradeOffs && <Detail label="Trade-offs" tone="var(--color-warn)">{sel.tradeOffs}</Detail>}
                  {(incoming.length > 0 || sel.connectsTo.length > 0) && (
                    <Detail label="Connections" tone="var(--color-line)">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {incoming.map((c) => (
                          <button key={c.id} onClick={() => choose(c.id)} className="rounded-full border border-line px-2 py-0.5 transition-colors hover:border-muted">
                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: c.color }} />{c.label} →
                          </button>
                        ))}
                        {sel.connectsTo.map((id) => byId[id] && (
                          <button key={id} onClick={() => choose(id)} className="rounded-full border border-line px-2 py-0.5 transition-colors hover:border-muted">
                            → <span className="mx-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: byId[id].color }} />{byId[id].label}
                          </button>
                        ))}
                      </div>
                    </Detail>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => setIsolated(isolated === sel.id ? null : sel.id)}>{isolated === sel.id ? "Show all parts" : "Isolate this part"}</Button>
                  <Button
                    variant="primary"
                    data-testid="explain-btn"
                    onClick={(e: MouseEvent<HTMLButtonElement>) => {
                      // Spec requirement: only trust real user clicks, not synthetic events
                      if (!e.isTrusted) return;
                      setExplainCtx({
                        sceneTitle: subject.title,
                        label: sel.label,
                        kind: kindLabels[kindOf(sel)],
                        zone: sel.zone,
                        summary: sel.summary,
                        details: sel.details,
                        apis: sel.apis,
                        dataModel: sel.dataModel,
                        failureMode: sel.failureMode,
                        tradeOffs: sel.tradeOffs,
                        scaling: sel.scaling,
                      });
                      setChatOpen(true);
                    }}
                  >
                    <MessageSquareText size={13} className="mr-1.5 inline align-[-1px]" />Explain
                  </Button>
                  <Button disabled={remember.isPending} onClick={() => remember.mutate("Remembered from Visual Learning: " + subject.title + " — " + sel.label + ". " + sel.summary)}>Remember</Button>
                  <Button disabled={remember.isPending} onClick={() => remember.mutate("Added from Visual Learning to " + subject.title + ": " + sel.label + ". " + sel.summary)}>Add to Project</Button>
                </div>
              </div>
            ) : scene ? (
              <div>
                <p className="text-sm text-muted">Select a part in the scene or in the parts list to see what it does, its APIs, failure modes and scaling.</p>
                <div className="mt-3 flex items-center gap-3">
                  <Button variant="primary" onClick={() => goStep(0)}>Start guided tour</Button>
                  <span className="text-xs text-muted">{steps.length} steps</span>
                </div>
              </div>
            ) : <p className="text-sm text-muted">Choose a system to explore.</p>}
          </Panel>
          <Panel title="Hand gestures (optional)"><GestureGuide tracking={tracking} status={gestureStatus} />{remember.isSuccess && <p role="status" className="mt-2 rounded bg-ok/10 p-2 text-xs text-ok">Saved as a VISION memory linked to {subject.title}. <button className="font-semibold text-accent hover:underline" onClick={() => setChatOpen(true)}>Ask AI about it</button></p>}{remember.error && <p className="mt-1 text-xs text-danger">Memory save failed. Try the button above.</p>}</Panel>
        </div>
      </div>
      {/* Floating explain chat — opened only by a real user click on the Explain button */}
      <FloatingExplainChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        explainContext={explainCtx}
        currentContext={sel ? {
          sceneTitle: subject.title,
          label: sel.label,
          kind: kindLabels[kindOf(sel)],
          zone: sel.zone,
          summary: sel.summary,
          details: sel.details,
          apis: sel.apis,
          dataModel: sel.dataModel,
          failureMode: sel.failureMode,
          tradeOffs: sel.tradeOffs,
          scaling: sel.scaling,
        } : null}
        onMemorySaved={() => qc.invalidateQueries({ queryKey: ["memories"] })}
      />
    </div>
  );
}
