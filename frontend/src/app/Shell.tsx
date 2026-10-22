import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api, readAuthToken, saveAuthToken } from "../lib/api";
import { Badge, Button, ErrorState, inputCls } from "../components/ui";
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
  const qc = useQueryClient();
  const [authenticated, setAuthenticated] = useState(() => !!readAuthToken());
  const { activeId, setActiveId } = useActiveWorkspace();
  const { data: workspaces } = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces });
  const active = workspaces?.find((w) => w.id === activeId);
  useEffect(() => {
    const expired = () => { setAuthenticated(false); qc.clear(); };
    window.addEventListener("orbit:auth-expired", expired);
    return () => window.removeEventListener("orbit:auth-expired", expired);
  }, [qc]);
  if (!authenticated) return <AuthScreen onAuthenticated={() => { setAuthenticated(true); qc.invalidateQueries(); }} />;
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
          <Button variant="ghost" onClick={() => { saveAuthToken(null); setAuthenticated(false); qc.clear(); }}>Sign out</Button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-5"><Outlet /></main>
      </div>
    </div>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const result = await api.authenticate(mode, email, password);
      saveAuthToken(result.access_token); onAuthenticated();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <main className="grid min-h-full place-items-center p-5">
      <section className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-semibold">ORBIT</h1>
        <p className="mt-1 text-sm text-muted">Sign in to access your personal workspace.</p>
        {Boolean(error) && <div className="mt-4"><ErrorState error={error} /></div>}
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block text-sm">Email<input required type="email" autoComplete="email" className={`${inputCls} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="block text-sm">Password<input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className={`${inputCls} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</Button>
        </form>
        <button className="mt-4 text-sm text-accent underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>{mode === "login" ? "Create an account" : "I already have an account"}</button>
      </section>
    </main>
  );
}
