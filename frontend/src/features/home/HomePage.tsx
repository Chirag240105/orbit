import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useActiveWorkspace } from "../../app/WorkspaceContext";
import { LogoMark } from "../../components/Logo";
import { Icon, type IconName } from "../../components/icons";
import { Badge, EmptyState, ErrorState, Panel, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { timeAgo } from "../../lib/format";

const ACTIONS: [string, IconName, string, string][] = [
  ["/chat", "chat", "Start a chat", "Ask, learn a topic, summarize, or plan."],
  ["/projects", "folder", "Inspect a project", "Authorize a folder, explain files, and let the project agent write notes for your approval."],
  ["/visual", "cube", "Open Visual Learning Studio", "Explore 3D system scenes, or show a printed marker to the camera."],
];

export function HomePage() {
  const { setActiveId } = useActiveWorkspace();
  const convs = useQuery({ queryKey: ["conversations"], queryFn: api.conversations });
  const ws = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces });
  const changes = useQuery({ queryKey: ["changes", "pending"], queryFn: () => api.changes("pending") });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
  const proposed = tasks.data?.filter((t) => t.status === "proposed") ?? [];
  const pending = (changes.data?.length ?? 0) + proposed.length;
  const failed = [convs, ws, changes, tasks].find((q) => q.error);

  return (
    <div className="max-w-5xl">
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-sm shadow-black/5 md:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          <LogoMark className="h-16 w-16 md:h-20 md:w-20" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">NVIDIA Nemotron · Nebius Token Factory</p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight md:text-3xl">Welcome to ORBIT</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">One personal agent with memory you control, skills with declared permissions, and access only to the folders you authorize.</p>
          </div>
        </div>
      </section>
      {failed && <div className="mb-5"><ErrorState error={failed.error} retry={() => [convs, ws, changes, tasks].forEach((q) => q.refetch())} /></div>}
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {ACTIONS.map(([to, icon, title, body]) => (
          <Link key={to} to={to} className="group flex flex-col rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/5 transition-colors hover:border-accent/60 hover:bg-raised">
            <span className="w-fit rounded-lg bg-accent/10 p-2 text-accent"><Icon name={icon} className="h-5 w-5" /></span>
            <p className="mt-3 flex items-center gap-1.5 font-medium">{title}<Icon name="arrow" className="h-3.5 w-3.5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" /></p>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Waiting for your approval">
          {changes.isLoading || tasks.isLoading ? <Skeleton /> : failed ? <p className="text-sm text-muted">Unavailable while the backend is unreachable.</p> : pending === 0 ? <p className="text-sm text-muted">Nothing is waiting. File changes and AI-proposed tasks appear here first.</p> : (
            <ul className="space-y-2 text-sm">
              {changes.data?.map((c) => <li key={`c${c.id}`}><Link className="hover:underline" to="/projects"><Badge color="warn">File change</Badge> <span className="font-mono text-xs">{c.rel_path}</span></Link></li>)}
              {proposed.map((t) => <li key={`t${t.id}`}><Link className="hover:underline" to="/tasks"><Badge color="warn">Task</Badge> {t.title}</Link></li>)}
            </ul>
          )}
        </Panel>
        <Panel title="Recent conversations">
          {convs.isLoading ? <Skeleton /> : convs.data?.length ? (
            <ul className="space-y-1.5 text-sm">{convs.data.slice(0, 5).map((c) => <li key={c.id} className="flex justify-between gap-3"><Link className="truncate hover:underline" to="/chat" state={{ conversationId: c.id }}>{c.title}</Link><span className="shrink-0 text-xs text-muted">{timeAgo(c.updated_at)}</span></li>)}</ul>
          ) : <p className="text-sm text-muted">No conversations yet.</p>}
        </Panel>
        <Panel title="Projects" className="md:col-span-2">
          {ws.isLoading ? <Skeleton /> : ws.data?.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">{ws.data.map((w) => <li key={w.id}><Link to="/projects" onClick={() => setActiveId(w.id)} className="block rounded-lg border border-line p-3 text-sm transition-colors hover:border-accent/60 hover:bg-raised"><span className="font-medium">{w.name}</span> <Badge color={w.allow_write ? "warn" : "ok"}>{w.allow_write ? "Read and write" : "Read only"}</Badge><span className="mt-1 block truncate font-mono text-xs text-muted">{w.path}</span></Link></li>)}</ul>
          ) : <EmptyState title="No projects authorized">ORBIT can't see any of your files until you authorize a folder in Projects.</EmptyState>}
        </Panel>
      </div>
    </div>
  );
}
