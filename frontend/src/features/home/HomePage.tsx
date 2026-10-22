import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Brain, FolderGit2, MessageSquare, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useActiveWorkspace } from "../../app/WorkspaceContext";
import { OrbitMark } from "../../components/Logo";
import { Badge, Button, EmptyState, Panel, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import { subjects } from "../../vision/scenes";

const EXAMPLES = ["Uber", "Netflix", "WhatsApp", "ChatGPT", "Google Search", "a stock exchange"];

export function HomePage() {
  const navigate = useNavigate();
  const { setActiveId } = useActiveWorkspace();
  const [topic, setTopic] = useState("");
  const convs = useQuery({ queryKey: ["conversations"], queryFn: api.conversations });
  const ws = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces });
  const changes = useQuery({ queryKey: ["changes", "pending"], queryFn: () => api.changes("pending") });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
  const memories = useQuery({ queryKey: ["memories", ""], queryFn: () => api.memories("") });
  const proposed = tasks.data?.filter((t) => t.status === "proposed") ?? [];
  const pending = (changes.data?.length ?? 0) + proposed.length;
  const explore = (value: string) => { const t = value.trim(); if (t) navigate(`/visual?q=${encodeURIComponent(t)}`); };
  const submit = (event: FormEvent) => { event.preventDefault(); explore(topic); };

  return (
    <div>
      <div className="mb-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="flex max-w-4xl items-start gap-5">
        <OrbitMark size={56} className="mt-1 hidden shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[2.1rem] font-semibold leading-tight tracking-[-0.03em]">What do you want to understand today?</h1>
          <p className="mt-2 max-w-2xl text-[0.95rem] text-muted">Name any system and ORBIT builds it as an explorable 3D architecture, with every part explained.</p>
          <form onSubmit={submit} className="mt-5 flex flex-wrap gap-2" aria-label="Explore a system">
            <div className="relative min-w-60 flex-1">
              <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <label htmlFor="home-topic" className="sr-only">System to explore</label>
              <input id="home-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} placeholder="Uber, Netflix, a bank, a multiplayer game…" className="w-full rounded-xl border border-line bg-surface py-3 pl-11 pr-4 text-[0.95rem] placeholder:text-muted/80 focus:border-accent" />
            </div>
            <Button variant="primary" className="rounded-xl px-5" disabled={!topic.trim()}>Explore system</Button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 text-muted">Try</span>
            {EXAMPLES.map((e) => (
              <button key={e} type="button" onClick={() => explore(e)} className="rounded-full border border-line px-3 py-1 text-muted transition-colors hover:border-muted hover:text-text">{e}</button>
            ))}
          </div>
        </div>
      </section>

      <Panel title="Ready to explore" className="hidden xl:block">
        <ul className="space-y-1">
          {subjects.map((sub) => (
            <li key={sub.id}>
              <Link to={`/visual?q=${encodeURIComponent(sub.title)}`} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-raised">
                <span className="flex -space-x-1.5" aria-hidden>
                  {sub.scene!.components.slice(0, 3).map((c) => <span key={c.id} className="h-3 w-3 rounded-full ring-2 ring-surface" style={{ background: c.color }} />)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{sub.title}</span>
                  <span className="block text-xs text-muted">{sub.scene!.components.length} parts · built in</span>
                </span>
                <ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
      </div>

      <nav aria-label="Shortcuts" className="mb-6 flex flex-wrap gap-x-6 gap-y-2 border-y border-line py-3 text-sm">
        {([["/chat", "Ask in the AI Workspace", MessageSquare], ["/projects", "Explain a project's code", FolderGit2], ["/memory", "Review what you've saved", Brain]] as const).map(([to, label, Icon]) => (
          <Link key={to} to={to} className="group inline-flex items-center gap-2 text-muted transition-colors hover:text-text">
            <Icon size={15} className="text-nebula" />{label}<ArrowRight size={14} className="-translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        <Panel title="Recently saved" action={<Link to="/memory" className="text-xs font-semibold text-accent hover:underline">All memories</Link>}>
          {memories.isLoading ? <Skeleton /> : memories.data?.length ? (
            <ul className="space-y-2.5 text-sm">{memories.data.slice(0, 4).map((m) => (
              <li key={m.id} className="min-w-0">
                <p className="line-clamp-2">{m.content}</p>
                <p className="mt-0.5 text-xs text-muted">{m.type === "VISION" ? "From Visual Learning" : m.type.charAt(0) + m.type.slice(1).toLowerCase()} · {timeAgo(m.updated_at)}</p>
              </li>
            ))}</ul>
          ) : <p className="text-sm text-muted">Nothing saved yet. Press Remember on a part in Visual Learning to keep it here.</p>}
        </Panel>
        <Panel title="Projects" className="md:col-span-2 xl:col-span-3">
          {ws.isLoading ? <Skeleton /> : ws.data?.length ? (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{ws.data.map((w) => <li key={w.id}><Link to="/projects" onClick={() => setActiveId(w.id)} className="block rounded-lg border border-line p-3 text-sm transition-colors hover:border-accent"><span className="font-medium">{w.name}</span> <Badge color={w.allow_write ? "warn" : "ok"}>{w.allow_write ? "Read and write" : "Read only"}</Badge><span className="mt-1 block truncate font-mono text-xs text-muted">{w.path}</span></Link></li>)}</ul>
          ) : <EmptyState title="No projects authorized">ORBIT can't see any of your files until you authorize a folder in Projects.</EmptyState>}
        </Panel>
      </div>
    </div>
  );
}
