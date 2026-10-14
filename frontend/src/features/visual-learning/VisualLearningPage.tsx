import { Link } from "react-router-dom";
import { useState } from "react";
import { Badge, Button, EmptyState, PageHeader, Panel } from "../../components/ui";
import { CameraPanel } from "./CameraPanel";
import { SceneCanvas } from "./SceneCanvas";
import { stepsOf, subjects } from "./scenes";

export function VisualLearningPage() {
  const [subjectId, setSubjectId] = useState(subjects[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [learning, setLearning] = useState<number | null>(null);
  const subject = subjects.find((s) => s.id === subjectId)!;
  const scene = subject.scene;
  const steps = scene ? stepsOf(scene) : [];
  const sel = scene?.components.find((c) => c.id === selected);

  const pickSubject = (id: string) => { setSubjectId(id); setSelected(null); setIsolated(null); setLearning(null); setReady(false); };
  const goStep = (i: number) => { setLearning(i); setSelected(steps[i].id); setIsolated(null); };

  return (
    <div>
      <PageHeader title="Visual Learning Studio" description="Explore a curated 3D scene. Rotate by dragging, zoom with scroll or pinch, pan with right-drag. Select any part to read about it." />
      <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Subjects">
        {subjects.map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === subjectId} onClick={() => pickSubject(s.id)} className={`rounded-md border px-3 py-1.5 text-sm ${s.id === subjectId ? "border-accent bg-accent/10" : "border-line hover:border-muted"}`}>
            {s.title} {!s.supported && <Badge>Planned</Badge>}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div>
          {!scene ? (
            <EmptyState title={`${subject.title} isn't supported yet`}>{subject.note} Add a scene in <code className="font-mono">features/visual-learning/scenes.ts</code>.</EmptyState>
          ) : (
            <div className="relative h-[26rem] overflow-hidden rounded-lg border border-line md:h-[32rem]">
              {!ready && <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg text-sm text-muted">Loading 3D scene…</div>}
              <SceneCanvas scene={scene} selectedId={selected} isolatedId={isolated} resetKey={resetKey} onSelect={(id) => { setSelected(id); setLearning(null); }} onReady={() => setReady(true)} />
              <div className="absolute bottom-3 left-3 flex gap-2">
                <Button onClick={() => { setResetKey((k) => k + 1); setSelected(null); setIsolated(null); }}>Reset view</Button>
                {isolated && <Button onClick={() => setIsolated(null)}>Show all parts</Button>}
              </div>
            </div>
          )}
          {scene && <p className="mt-2 text-xs text-muted">{scene.description} This is a hand-built scene, not a reconstruction from the camera.</p>}
        </div>
        <div className="space-y-4">
          <Panel title="Explanation">
            {sel ? (
              <div>
                <h3 className="font-medium">{sel.label}</h3>
                <p className="mt-1 text-sm text-accent">{sel.summary}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{sel.details}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => setIsolated(isolated === sel.id ? null : sel.id)}>{isolated === sel.id ? "Show all parts" : "Isolate this part"}</Button>
                  <Link to="/chat" state={{ prompt: `In a three-tier cloud web app, explain the "${sel.label}" in simple terms, and what breaks if it fails.` }}><Button variant="ghost">Ask ORBIT in chat</Button></Link>
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
          <Panel title="Camera (optional)"><CameraPanel /></Panel>
        </div>
      </div>
    </div>
  );
}
