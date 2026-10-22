import { Link } from "react-router-dom";
import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, EmptyState, PageHeader, Panel } from "../components/ui";
import { api } from "../lib/api";
import { CameraPanel } from "./CameraPanel";
import type { HandGesture, HandTrackState } from "./CameraPanel";
import { SceneCanvas } from "./SceneCanvas";
import { createTopicScene, stepsOf, subjects, type Scene } from "./scenes";
import type { CursorPosition } from "./gestures";

export function VisualLearningPage() {
  const qc = useQueryClient();
  const [subjectId, setSubjectId] = useState(subjects[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [learning, setLearning] = useState<number | null>(null);
  const [gestureStatus, setGestureStatus] = useState("");
  const [gestureControlsPaused, setGestureControlsPaused] = useState(false);
  const [topic, setTopic] = useState("");
  const [customScene, setCustomScene] = useState<Scene | null>(null);
  const [showOverview, setShowOverview] = useState(false);
  // Use a ref for hand tracking to avoid re-rendering on every inference frame.
  const handTrackRef = useRef<HandTrackState | null>(null);
  const subject = customScene
    ? { id: customScene.id, title: customScene.title, supported: true, scene: customScene }
    : subjects.find((s) => s.id === subjectId)!;
  const scene = customScene ?? subject.scene;
  const steps = scene ? stepsOf(scene) : [];
  const sel = scene?.components.find((c) => c.id === selected);
  const remember = useMutation({
    mutationFn: (content: string) => api.saveVisionContext({ content, project_name: subject.title }),
    onSuccess: () => { setGestureStatus("Saved as a confirmed VISION memory linked to " + subject.title + "."); qc.invalidateQueries({ queryKey: ["memories"] }); },
    onError: () => setGestureStatus("Could not save the visual memory."),
  });
  const handleGesture = (gesture: HandGesture, position: CursorPosition) => {
    if (!scene) return;
    const components = scene.components;
    const targetIndex = Math.min(components.length - 1, Math.max(0, Math.floor(position.screenX * components.length)));
    if (gesture === "point") {
      setSelected(components[targetIndex].id); setLearning(null);
      setGestureStatus("Point selected " + components[targetIndex].label + ".");
    } else if (gesture === "swipe_left" || gesture === "swipe_right") {
      const currentIndex = Math.max(0, components.findIndex((component) => component.id === selected));
      const nextIndex = (currentIndex + (gesture === "swipe_right" ? 1 : -1) + components.length) % components.length;
      setSelected(components[nextIndex].id); setLearning(null);
      setGestureStatus("Swipe selected " + components[nextIndex].label + ".");
    } else if (gesture === "open") {
      const nextPaused = !gestureControlsPaused;
      setGestureControlsPaused(nextPaused);
      setSelected(null); setIsolated(null); setLearning(null);
      setGestureStatus(nextPaused ? "Open hand paused gesture controls; show an open hand again to resume." : "Open hand resumed gesture controls.");
    } else {
      const target = sel ?? components[targetIndex];
      setSelected(target.id); setLearning(null);
      remember.mutate("Remembered from the camera: " + subject.title + " — " + target.label + ". " + target.summary);
    }
  };

  const pickSubject = (id: string) => { setCustomScene(null); setSubjectId(id); setSelected(null); setIsolated(null); setLearning(null); setReady(false); setShowOverview(false); };
  const buildTopic = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!topic.trim()) return;
    setCustomScene(createTopicScene(topic)); setSelected(null); setIsolated(null); setLearning(null); setReady(false); setResetKey((key) => key + 1); setShowOverview(false);
  };
  const goStep = (i: number) => { setLearning(i); setSelected(steps[i].id); setIsolated(null); };

  return (
    <div>
      <PageHeader title="Visual Learning Studio" description="Choose a topic to build an explorable learning map, then follow its parts step by step." />
      <form onSubmit={buildTopic} className="mb-4 flex flex-wrap gap-2" aria-label="Build a topic scene">
        <label className="sr-only" htmlFor="learning-topic">What do you want to learn?</label>
        <input id="learning-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={80} placeholder="What do you want to learn? Try: banking system" className="min-w-60 flex-1 rounded-md border border-line bg-bg px-3 py-2 text-sm" />
        <Button variant="primary" disabled={!topic.trim()}>Build learning map</Button>
      </form>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Subjects">
        {subjects.map((s) => (
          <button key={s.id} role="tab" aria-selected={!customScene && s.id === subjectId} onClick={() => pickSubject(s.id)} className={`rounded-md border px-3 py-1.5 text-sm ${!customScene && s.id === subjectId ? "border-accent bg-accent/10" : "border-line hover:border-muted"}`}>
            {s.title} {!s.supported && <Badge>Planned</Badge>}
          </button>
        ))}
      </div>
      {scene?.overview && (
        <div className="mb-3">
          <button onClick={() => setShowOverview((v) => !v)} aria-expanded={showOverview} className="flex items-center gap-1 text-sm text-accent hover:underline">
            {showOverview ? "Hide" : "Show"} system-design overview
          </button>
          {showOverview && (
            <div className="mt-2 grid gap-4 lg:grid-cols-2">
              <Panel title="Requirements">
                <ul className="list-disc space-y-1 pl-5 text-sm">{scene.overview.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
                <p className="mt-3 text-xs font-medium text-muted">Assumptions</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{scene.overview.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </Panel>
              <Panel title="Architecture">
                <p className="text-sm leading-relaxed">{scene.overview.architecture}</p>
                <p className="mt-3 text-xs font-medium text-muted">Request flow</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{scene.overview.requestFlow.map((step, i) => <li key={i}>{step}</li>)}</ol>
              </Panel>
            </div>
          )}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div>
          {!scene ? (
            <EmptyState title={`${subject.title} isn't supported yet`}>{subject.note} Add a scene in <code className="font-mono">vision/scenes.ts</code>.</EmptyState>
          ) : (
            <div className="relative h-[26rem] overflow-hidden rounded-lg border border-line md:h-[32rem]">
              {!ready && <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg text-sm text-muted">Loading 3D scene…</div>}
              <SceneCanvas scene={scene} selectedId={selected} isolatedId={isolated} resetKey={resetKey} handTrackRef={handTrackRef} onSelect={(id) => { setSelected(id); setLearning(null); }} onReady={() => setReady(true)} />
              <div className="absolute bottom-3 left-3 flex gap-2">
                <Button onClick={() => { setResetKey((k) => k + 1); setSelected(null); setIsolated(null); }}>Reset view</Button>
                {isolated && <Button onClick={() => setIsolated(null)}>Show all parts</Button>}
              </div>
            </div>
          )}
          {scene && <p className="mt-2 text-xs text-muted">{scene.description} Drag to rotate, scroll to zoom, pinch with a camera to grab, and select a component to explore it.</p>}
        </div>
        <div className="space-y-4">
          <Panel title="Explanation">
            {sel ? (
              <div>
                <h3 className="font-medium">{sel.label}</h3>
                <p className="mt-1 text-sm text-accent">{sel.summary}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{sel.details}</p>
                {sel.apis && <div className="mt-3"><p className="text-xs font-medium text-muted">APIs</p><p className="mt-1 font-mono text-xs text-text/90">{sel.apis}</p></div>}
                {sel.dataModel && <div className="mt-2"><p className="text-xs font-medium text-muted">Data model</p><p className="mt-1 text-xs text-text/90">{sel.dataModel}</p></div>}
                {sel.scaling && <div className="mt-2"><p className="text-xs font-medium text-muted">Scaling</p><p className="mt-1 text-xs text-text/90">{sel.scaling}</p></div>}
                {sel.failureMode && <div className="mt-2"><p className="text-xs font-medium text-muted">What can go wrong</p><p className="mt-1 text-xs text-danger/90">{sel.failureMode}</p></div>}
                {sel.tradeOffs && <div className="mt-2"><p className="text-xs font-medium text-muted">Trade-offs</p><p className="mt-1 text-xs text-warn/90">{sel.tradeOffs}</p></div>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => setIsolated(isolated === sel.id ? null : sel.id)}>{isolated === sel.id ? "Show all parts" : "Isolate this part"}</Button>
                  <Link to="/chat" state={{ prompt: `Explain the "${sel.label}" in the ${subject.title} architecture in simple terms, and what breaks if it fails.` }}><Button>Explain</Button></Link>
                  <Button disabled={remember.isPending} onClick={() => remember.mutate("Remembered from Visual Learning: " + subject.title + " — " + sel.label + ". " + sel.summary)}>Remember</Button>
                  <Button variant="primary" disabled={remember.isPending} onClick={() => remember.mutate("Added from Visual Learning to " + subject.title + ": " + sel.label + ". " + sel.summary)}>Add to Project</Button>
                </div>
              </div>
            ) : <p className="text-sm text-muted">{scene ? "Select a part in the scene or in the list below." : "Choose a supported subject."}</p>}
          </Panel>
          {scene && (
            <Panel title="Learn step by step" action={learning === null ? <Button variant="primary" onClick={() => goStep(0)}>Start</Button> : <Button variant="ghost" onClick={() => setLearning(null)}>Exit</Button>}>
              {learning === null ? <p className="text-sm text-muted">Follow a request from the user through every part, one at a time.</p> : (
                <div>
                  <p className="text-xs text-muted">Step {learning + 1} of {steps.length}</p>
                  <p className="mt-1 text-sm font-medium">{steps[learning].label}</p>
                  <p className="mt-1 text-xs text-muted">{steps[learning].summary}</p>
                  <div className="mt-3 flex gap-2">
                    <Button disabled={learning === 0} onClick={() => goStep(learning - 1)}>Back</Button>
                    <Button variant="primary" disabled={learning === steps.length - 1} onClick={() => goStep(learning + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </Panel>
          )}
          {scene && (
            <Panel title="Parts">
              <ul className="space-y-1">{scene.components.map((c) => (
                <li key={c.id}><button onClick={() => { setSelected(c.id); setLearning(null); }} aria-pressed={selected === c.id} className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-raised ${selected === c.id ? "bg-raised" : ""}`}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: c.color }} />{c.label}</button></li>
              ))}</ul>
            </Panel>
          )}
          <Panel title="Camera and gestures (optional)"><CameraPanel onGesture={handleGesture} onHandTrack={(s) => { handTrackRef.current = s; }} /><p role="status" className="mt-2 text-xs text-muted">{gestureStatus || "Use point, pinch to grab and rotate, open hand, or swipe left/right. The mouse and parts list remain available."}</p>{remember.isSuccess && <p role="status" className="mt-2 rounded bg-ok/10 p-2 text-xs text-ok">Saved as a VISION memory linked to {subject.title}. <Link to="/chat" state={{ prompt: `I saved a visual memory about ${sel?.label ?? "the selected architecture component"} in ${subject.title}. Confirm it and explain how it relates to the project.` }}>Continue in chat</Link></p>}{remember.error && <p className="mt-1 text-xs text-danger">Memory save failed. Try the button above.</p>}</Panel>
        </div>
      </div>
    </div>
  );
}
