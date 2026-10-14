import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../lib/api";
import { Badge } from "../components/ui";
import { useActiveWorkspace } from "./WorkspaceContext";

const NAV = [
  ["/", "Home"], ["/chat", "AI Workspace"], ["/projects", "Projects"], ["/visual", "Visual Learning"],
  ["/memory", "Memory"], ["/skills", "Skills"], ["/tasks", "Tasks and Plans"], ["/settings", "Settings and Privacy"],
] as const;

function AgentStatus() {
  const { data, isError } = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 15000 });
  if (isError) return <Badge color="danger">Backend offline</Badge>;
  if (!data) return <Badge>Checking…</Badge>;
  const p = data.provider;
  if (p.is_demo) return <Badge color="warn">Demo mode, no model</Badge>;
  if (!p.configured) return <Badge color="warn">Model not configured</Badge>;
  return <Badge color="ok">Model connected: {p.model.split("/").pop()}</Badge>;
}

export function Shell() {
  const { activeId, setActiveId } = useActiveWorkspace();
  const { data: workspaces } = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces });
  const active = workspaces?.find((w) => w.id === activeId);
  return (
    <div className="flex h-full flex-col md:flex-row">
      <nav aria-label="Primary" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-surface p-2 md:w-56 md:flex-col md:border-b-0 md:border-r md:p-3">
        <div className="hidden px-2 pb-3 pt-1 md:block">
          <p className="text-lg font-semibold tracking-tight">ORBIT</p>
          <p className="text-xs text-muted">Your personal AI operating layer</p>
        </div>
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${isActive ? "bg-raised text-text" : "text-muted hover:bg-raised/60 hover:text-text"}`}>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted">Workspace</span>
            <select aria-label="Active workspace" value={activeId ?? ""} onChange={(e) => setActiveId(e.target.value ? Number(e.target.value) : null)} className="rounded-md border border-line bg-bg px-2 py-1">
              <option value="">None authorized</option>
              {workspaces?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {active && <Badge color={active.allow_write ? "warn" : "ok"}>{active.allow_write ? "Read and write" : "Read only"}</Badge>}
          </div>
          <AgentStatus />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-5"><Outlet /></main>
      </div>
    </div>
  );
}
