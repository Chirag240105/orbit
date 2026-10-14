import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge, Button, ConfirmDialog, ErrorState, PageHeader, Panel, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { kb } from "../../lib/format";

type Danger = "history" | "memory" | null;

export function SettingsPage() {
  const qc = useQueryClient();
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const info = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const ws = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces });
  const [danger, setDanger] = useState<Danger>(null);
  const [cam, setCam] = useState("unknown");
  useEffect(() => {
    navigator.permissions?.query({ name: "camera" as PermissionName }).then((r) => { setCam(r.state); r.onchange = () => setCam(r.state); }).catch(() => setCam("unknown"));
  }, []);
  const wipe = useMutation({ mutationFn: () => (danger === "history" ? api.deleteAllConversations() : api.deleteAllMemories()), onSuccess: () => { setDanger(null); qc.invalidateQueries(); } });
  const p = info.data?.provider;

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Settings and Privacy" description="See what ORBIT can access, what leaves your computer, and how to remove what it stores." />
      <Panel title="Model provider and backend">
        {health.error || info.error ? <ErrorState error={health.error ?? info.error} retry={() => { health.refetch(); info.refetch(); }} /> : !health.data || !p ? <Skeleton className="h-12" /> : (
          <dl className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-[9rem_1fr] sm:gap-y-2">
            <dt className="text-muted">Backend</dt><dd><Badge color="ok">Healthy</Badge> v{health.data.version}, database {health.data.database}</dd>
            <dt className="text-muted">Provider</dt><dd>{p.is_demo ? <Badge color="warn">Demo mode: no model, no network</Badge> : p.configured ? <><Badge color="ok">Configured</Badge> {p.name}, <span className="font-mono">{p.model}</span></> : <Badge color="warn">Not configured</Badge>}</dd>
            <dt className="text-muted">API key</dt><dd className="text-muted">Held by the backend only. It is never sent to this page. Set it in <code className="font-mono">.env</code>.</dd>
            <dt className="text-muted">Skill routing</dt><dd>{info.data?.model_routing ? "The model picks a skill when you don't (one extra call)" : "Keywords pick a skill when you don't"} <span className="text-muted">(ORBIT_MODEL_ROUTING)</span></dd>
            <dt className="text-muted">Local access</dt><dd className="text-muted">Every API call needs a token the backend generates at start. The dev server adds it, so other programs and websites can't use the API.</dd>
            <dt className="text-muted">Limits</dt><dd>{info.data && `${kb(info.data.limits.max_file_bytes)} per file, ${info.data.limits.max_context_chars.toLocaleString()} characters of file context per request`}</dd>
          </dl>
        )}
      </Panel>
      <Panel title="What leaves your computer">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">{info.data?.privacy.map((t) => <li key={t}>{t}</li>)}</ul>
      </Panel>
      <Panel title="Authorized workspaces">
        {ws.data?.length ? <ul className="space-y-1 text-sm">{ws.data.map((w) => <li key={w.id} className="flex items-center gap-2"><span className="font-medium">{w.name}</span><Badge color={w.allow_write ? "warn" : "ok"}>{w.allow_write ? "Read and write" : "Read only"}</Badge><span className="truncate font-mono text-xs text-muted">{w.path}</span></li>)}</ul> : <p className="text-sm text-muted">None. Manage workspaces in Projects.</p>}
      </Panel>
      <Panel title="Tool permissions">
        <p className="mb-3 text-sm text-muted">Tools are checked by the backend on every call. The model cannot run shell commands or reach files outside an authorized workspace.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[28rem] text-left text-sm"><thead className="text-xs text-muted"><tr><th className="pb-1 font-medium">Tool</th><th className="pb-1 font-medium">Needs</th><th className="pb-1 font-medium">Confirmation</th></tr></thead>
          <tbody>{info.data?.tools.map((t) => <tr key={t.name} className="border-t border-line"><td className="py-1.5"><span className="font-mono text-xs">{t.name}</span><span className="block text-xs text-muted">{t.description}</span></td><td>{t.permissions.map((x) => <Badge key={x}>{x}</Badge>)}</td><td>{t.requires_confirmation ? "Required each time" : "Not needed"}</td></tr>)}</tbody></table></div>
      </Panel>
      <Panel title="Camera">
        <p className="text-sm">Browser permission: <Badge color={cam === "granted" ? "warn" : "neutral"}>{cam}</Badge></p>
        <p className="mt-2 text-sm text-muted">The camera only starts when you press Start in Visual Learning Studio, and an indicator shows while it is on. Video is not recorded or uploaded. Change the permission in your browser's site settings.</p>
      </Panel>
      <Panel title="Delete stored data">
        <div className="flex flex-wrap gap-2"><Button variant="danger" onClick={() => setDanger("history")}>Delete all conversation history</Button><Button variant="danger" onClick={() => setDanger("memory")}>Delete all memories</Button></div>
      </Panel>
      <ConfirmDialog open={!!danger} danger title={danger === "history" ? "Delete all conversations?" : "Delete all memories?"} body="This can't be undone." confirmLabel="Delete" onCancel={() => setDanger(null)} onConfirm={() => wipe.mutate()} />
    </div>
  );
}
