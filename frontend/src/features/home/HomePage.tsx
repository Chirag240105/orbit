import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useActiveWorkspace } from "../../app/WorkspaceContext";
import { Badge, EmptyState, PageHeader, Panel, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { timeAgo } from "../../lib/format";

const linkCls = "block rounded-lg border border-line bg-surface p-4 hover:border-accent";

export function HomePage() {
  const { setActiveId } = useActiveWorkspace();
  const convs = useQuery({ queryKey: ["conversations"], queryFn: api.conversations });
  const ws = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces });
  const changes = useQuery({ queryKey: ["changes", "pending"], queryFn: () => api.changes("pending") });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
  const proposed = tasks.data?.filter((t) => t.status === "proposed") ?? [];
  const pending = (changes.data?.length ?? 0) + proposed.length;

  return (
    <div className="max-w-5xl">
      <PageHeader title="Welcome to ORBIT" description="One personal agent with memory you control, skills with declared permissions, and access only to the folders you authorize." />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Link to="/chat" className={linkCls}><p className="font-medium">Start a chat</p><p className="mt-1 text-sm text-muted">Ask, summarize, or plan.</p></Link>
        <Link to="/projects" className={linkCls}><p className="font-medium">Inspect a project</p><p className="mt-1 text-sm text-muted">Authorize a folder, then search and explain files.</p></Link>
        <Link to="/visual" className={linkCls}><p className="font-medium">Open Visual Learning Studio</p><p className="mt-1 text-sm text-muted">Explore a 3D cloud architecture.</p></Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Waiting for your approval">
          {changes.isLoading ? <Skeleton /> : pending === 0 ? <p className="text-sm text-muted">Nothing is waiting. File changes and AI-proposed tasks appear here first.</p> : (
            <ul className="space-y-2 text-sm">
              {changes.data?.map((c) => <li key={`c${c.id}`}><Link className="hover:underline" to="/projects"><Badge color="warn">File change</Badge> <span className="font-mono text-xs">{c.rel_path}</span></Link></li>)}
              {proposed.map((t) => <li key={`t${t.id}`}><Link className="hover:underline" to="/tasks"><Badge color="warn">Task</Badge> {t.title}</Link></li>)}
            </ul>
          )}
        </Panel>
        <Panel title="Recent conversations">
          {convs.isLoading ? <Skeleton /> : convs.data?.length ? (
            <ul className="space-y-1.5 text-sm">{convs.data.slice(0, 5).map((c) => <li key={c.id} className="flex justify-between gap-3"><Link className="truncate hover:underline" to="/chat">{c.title}</Link><span className="shrink-0 text-xs text-muted">{timeAgo(c.updated_at)}</span></li>)}</ul>
          ) : <p className="text-sm text-muted">No conversations yet.</p>}
        </Panel>
        <Panel title="Projects" className="md:col-span-2">
          {ws.isLoading ? <Skeleton /> : ws.data?.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">{ws.data.map((w) => <li key={w.id}><Link to="/projects" onClick={() => setActiveId(w.id)} className="block rounded-md border border-line p-3 text-sm hover:border-accent"><span className="font-medium">{w.name}</span> <Badge color={w.allow_write ? "warn" : "ok"}>{w.allow_write ? "Read and write" : "Read only"}</Badge><span className="mt-1 block truncate font-mono text-xs text-muted">{w.path}</span></Link></li>)}</ul>
          ) : <EmptyState title="No projects authorized">ORBIT can't see any of your files until you authorize a folder in Projects.</EmptyState>}
        </Panel>
      </div>
    </div>
  );
}
