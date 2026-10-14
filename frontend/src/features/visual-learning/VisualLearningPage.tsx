import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Panel } from "../../components/ui";
import { api } from "../../lib/api";
import { CameraPanel } from "./CameraPanel";
import { SceneCanvas, type ViewPreset } from "./SceneCanvas";
import { sceneForMarker, stepsOf, subjects, type Scene, type SceneComponent } from "./scenes";

function AiExplanation({ scene, part }: { scene: Scene; part: SceneComponent }) {
  const explain = useMutation({ mutationFn: () => api.explainComponent({ scene: scene.title, component: part.label, summary: part.summary, details: part.details }) });
  const r = explain.data;
  if (!r) return (
    <div className="mt-3">
      <Button variant="ghost" disabled={explain.isPending} onClick={() => explain.mutate()}>{explain.isPending ? "Asking ORBIT…" : "Explain more with AI"}</Button>
      {explain.error && <div className="mt-2"><ErrorState error={explain.error} retry={() => explain.mutate()} /></div>}
    </div>
  );
  return (
    <div className="mt-3 rounded-md border border-line p-3 text-sm">
      <div className="mb-1">{r.ai_generated ? <Badge color="accent">AI-generated{r.provider ? `: ${r.provider.model}` : ""}</Badge> : <Badge color="warn">Curated text (no model)</Badge>}</div>
      {r.ai_generated && <p className="whitespace-pre-wrap leading-relaxed">{r.explanation}</p>}
      {r.analogy && <p className="mt-2"><span className="text-muted">Analogy: </span>{r.analogy}</p>}
      {r.failure_impact && <p className="mt-2"><span className="text-muted">If it fails: </span>{r.failure_impact}</p>}
      {r.warnings.map((w) => <p key={w} className="mt-2 text-xs text-warn">{w}</p>)}
    </div>
  );
}

export function VisualLearningPage() {
  const [subjectId, setSubjectId] = useState(subjects[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [view, setView] = useState<ViewPreset>("overview");
  const [viewKey, setViewKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [learning, setLearning] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const current = useRef(subjectId);
  current.current = subjectId;
  const subject = subjects.find((s) => s.id === subjectId)!;
  const scene = subject.scene;
  const steps = scene ? stepsOf(scene) : [];
  const sel = scene?.components.find((c) => c.id === selected);

  const pickSubject = useCallback((id: string) => { setSubjectId(id); setSelected(null); setIsolated(null); setLearning(null); setView("overview"); setReady(false); }, []);
  const goStep = (i: number) => { setLearning(i); setSelected(steps[i].id); setIsolated(null); };
  const knownMarker = useCallback((id: number) => sceneForMarker(id)?.title, []);
  const onMarker = useCallback((id: number) => {
    const s = sceneForMarker(id);
    if (!s) return;
    setNotice(`Marker #${id} recognized: showing "${s.title}".`);
    if (current.current !== s.id) pickSubject(s.id);
  }, [pickSubject]);
  const setPreset = (v: ViewPreset) => { setView(v); setViewKey((k) => k + 1); };

  return (
    <div>
      <PageHeader title="Visual Learning Studio" description="Explore a curated 3D scene. Rotate by dragging, zoom with scroll or pinch, pan with right-drag. Select any part to read about it, or show a printed marker to the camera." />
      <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Subjects">
        {subjects.map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === subjectId} onClick={() => { setNotice(null); pickSubject(s.id); }} className={`rounded-md border px-3 py-1.5 text-sm ${s.id === subjectId ? "border-accent bg-accent/10" : "border-line hover:border-muted"}`}>
            {s.title} {!s.supported && <Badge>Planned</Badge>}
          </button>
        ))}
      </div>
      {notice && <p role="status" className="mb-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">{notice}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {!scene ? (
            <EmptyState title={`${subject.title} isn't supported yet`}>{subject.note} Add a scene in <code className="font-mono">features/visual-learning/scenes.ts</code>.</EmptyState>
          ) : (
            <div className="relative h-[24rem] overflow-hidden rounded-lg border border-line md:h-[32rem]">
              {!ready && <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg text-sm text-muted">Loading 3D scene…</div>}
              <SceneCanvas key={scene.id} scene={scene} selectedId={selected} isolatedId={isolated} view={view} viewKey={viewKey} onSelect={(id) => { setSelected(id); setLearning(null); }} onReady={() => setReady(true)} />
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
                <Button onClick={() => { setPreset("overview"); setSelected(null); setIsolated(null); }}>Reset view</Button>
                <Button onClick={() => setPreset("top")} aria-pressed={view === "top"}>Top</Button>
                <Button onClick={() => setPreset("front")} aria-pressed={view === "front"}>Front</Button>
                {isolated && <Button onClick={() => setIsolated(null)}>Show all parts</Button>}
              </div>
            </div>
          )}
          {scene && <p className="mt-2 text-xs text-muted">{scene.description} This is a hand-built scene, not a reconstruction from the camera.</p>}
        </div>
        <div className="min-w-0 space-y-4">
          <Panel title="Explanation">
            {sel && scene ? (
              <div>
                <h3 className="font-medium">{sel.label}</h3>
                <p className="mt-1 text-sm text-accent">{sel.summary}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{sel.details}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => setIsolated(isolated === sel.id ? null : sel.id)}>{isolated === sel.id ? "Show all parts" : "Isolate this part"}</Button>
                  <Link to="/chat" state={{ prompt: `In a ${scene.title.toLowerCase()}, explain the "${sel.label}" in simple terms, and what breaks if it fails.` }} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-raised hover:text-text">Ask ORBIT in chat</Link>
                </div>
                <AiExplanation key={`${scene.id}/${sel.id}`} scene={scene} part={sel} />
              </div>
            ) : <p className="text-sm text-muted">{scene ? "Select a part in the scene or in the list below." : "Choose a supported subject."}</p>}
          </Panel>
          {scene && (
            <Panel title="Learn step by step" action={learning === null ? <Button variant="primary" onClick={() => goStep(0)}>Start</Button> : <Button variant="ghost" onClick={() => setLearning(null)}>Exit</Button>}>
              {learning === null ? <p className="text-sm text-muted">Follow a request through every part, one at a time.</p> : (
                <div>
                  <p className="text-xs text-muted">Step {learning + 1} of {steps.length}</p>
                  <p className="mt-1 text-sm font-medium">{steps[learning].label}</p>
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
          <Panel title="Camera (optional)"><CameraPanel knownMarker={knownMarker} onMarker={onMarker} /></Panel>
        </div>
      </div>
    </div>
  );
}
