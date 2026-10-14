import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Skeleton, inputCls } from "../../components/ui";
import { api } from "../../lib/api";
import type { SchemaDoc, Skill } from "../../types/api";

const fields = (s: SchemaDoc) => Object.entries(s.properties ?? {}).map(([k, v]) => `${k}${s.required?.includes(k) ? "" : "?"}: ${v.type ?? "object"}`);

function SkillCard({ s }: { s: Skill }) {
  const qc = useQueryClient();
  const toggle = useMutation({ mutationFn: () => api.toggleSkill(s.name, !s.enabled), onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }) });
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-medium">{s.title}</h3><p className="mt-1 text-sm text-muted">{s.description}</p></div>
        <label className="flex shrink-0 items-center gap-2 text-sm"><input type="checkbox" checked={s.enabled} disabled={toggle.isPending} onChange={() => toggle.mutate()} />{s.enabled ? "Enabled" : "Disabled"}</label>
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <div><dt className="text-muted">Needs permission</dt><dd className="mt-1 flex flex-wrap gap-1">{s.required_permissions.map((p) => <Badge key={p} color={p.startsWith("workspace") ? "warn" : "neutral"}>{p}</Badge>)}</dd></div>
        <div><dt className="text-muted">Input</dt><dd className="mt-1 font-mono">{fields(s.input_schema).join(", ")}</dd></div>
        <div><dt className="text-muted">Output</dt><dd className="mt-1 font-mono">{fields(s.output_schema).join(", ")}</dd></div>
      </dl>
      {s.requires_files && <p className="mt-2 text-xs text-muted">Needs an authorized workspace and a selected file. Without one, ORBIT asks a clarifying question.</p>}
    </Panel>
  );
}

export function SkillsPage() {
  const [q, setQ] = useState("");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["skills"], queryFn: api.skills });
  const shown = data?.filter((s) => (s.title + s.description).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="max-w-3xl">
      <PageHeader title="Skills" description="Skills are reusable abilities with a fixed input, a validated output, and declared permissions. Turning a skill on never gives it more access than the permissions listed here." />
      <input aria-label="Search skills" className={`${inputCls} mb-4`} placeholder="Search skills" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading ? <Skeleton className="h-28" /> : error ? <ErrorState error={error} retry={() => refetch()} /> : !shown?.length ? <EmptyState title="No skills match" /> : <div className="space-y-3">{shown.map((s) => <SkillCard key={s.name} s={s} />)}</div>}
      <Panel title="Add your own skill" className="mt-6">
        <p className="text-sm text-muted">Skills are Python classes registered in <code className="font-mono">backend/app/skills/registry.py</code>. Follow <code className="font-mono">docs/SKILL_DEVELOPMENT.md</code> and the working example in <code className="font-mono">examples/example-skill</code>. Restart the backend and the new skill appears here.</p>
      </Panel>
    </div>
  );
}
