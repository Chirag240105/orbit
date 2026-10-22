import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Brain, FolderGit2, House, ListChecks, LogOut, MessageSquare, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sparkles, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api, readAuthToken, saveAuthToken } from "../lib/api";
import { Logo, OrbitMark, OrbitRing } from "../components/Logo";
import { Badge, Button, ErrorState, inputCls } from "../components/ui";
import { useTheme } from "./theme";
import { useActiveWorkspace } from "./WorkspaceContext";

const NAV_KEY = "orbit.navCollapsed";
const readCollapsed = () => { try { return localStorage.getItem(NAV_KEY) === "1"; } catch { return false; } };

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "light" ? "dark" : "light";
  return (
    <Button variant="ghost" onClick={toggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} className="px-2">
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </Button>
  );
}

const NAV: [string, string, LucideIcon][] = [
  ["/", "Home", House], ["/visual", "Visual Learning", Boxes], ["/chat", "AI Workspace", MessageSquare],
  ["/projects", "Projects", FolderGit2], ["/memory", "Memory", Brain], ["/skills", "Skills", Sparkles],
  ["/tasks", "Tasks and Plans", ListChecks], ["/settings", "Settings and Privacy", Settings],
];

function AgentStatus() {
  const { data, isError } = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 15000 });
  if (isError) return <Badge color="danger">Backend offline</Badge>;
  if (!data) return <Badge>Checking…</Badge>;
  const p = data.provider;
  if (p.is_demo) return <Badge color="warn">Demo mode, no model</Badge>;
  if (!p.configured) return <Badge color="warn">Model not configured</Badge>;
  return <Badge color="ok"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ok" />{p.model.split("/").pop()}</Badge>;
}

export function Shell() {
  const qc = useQueryClient();
  const [authenticated, setAuthenticated] = useState(() => !!readAuthToken());
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggleNav = () => setCollapsed((c) => { try { localStorage.setItem(NAV_KEY, c ? "0" : "1"); } catch { /* storage unavailable */ } return !c; });
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
      <nav aria-label="Primary" className={`flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-surface p-2 [scrollbar-width:none] md:flex-col md:items-stretch md:overflow-visible md:border-b-0 md:border-r md:py-4 md:transition-[width] md:duration-200 ${collapsed ? "md:w-[4.25rem] md:px-2" : "md:w-60 md:px-3"}`}>
        <span className="shrink-0 px-1.5 md:hidden"><OrbitMark size={26} /></span>
        <div className={`hidden pb-6 md:block ${collapsed ? "px-1.5" : "px-2"}`}>{collapsed ? <OrbitMark size={30} /> : <Logo tagline="Explore how systems work" />}</div>
        {NAV.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === "/"} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} className={({ isActive }) => `group relative flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${collapsed ? "md:justify-center md:px-0" : ""} ${isActive ? "bg-raised font-semibold text-text" : "text-muted hover:bg-raised/50 hover:text-text"}`}>
            {({ isActive }) => (
              <>
                <span className="relative grid h-6 w-6 shrink-0 place-items-center">
                  {isActive && <OrbitRing size={26} className="absolute text-accent" />}
                  <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? "text-accent" : ""} />
                </span>
                <span className={collapsed ? "md:sr-only" : ""}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button onClick={toggleNav} aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`mt-auto hidden items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-raised/50 hover:text-text md:flex ${collapsed ? "justify-center px-0" : ""}`}>
          <span className="grid h-6 w-6 shrink-0 place-items-center">{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</span>
          {!collapsed && "Collapse"}
        </button>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3 text-sm">
          <div className="flex items-center gap-2">
            <label htmlFor="active-workspace" className="text-muted">Workspace</label>
            <select id="active-workspace" aria-label="Active workspace" value={activeId ?? ""} onChange={(e) => setActiveId(e.target.value ? Number(e.target.value) : null)} className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm">
              <option value="">None authorized</option>
              {workspaces?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {active && <Badge color={active.allow_write ? "warn" : "ok"}>{active.allow_write ? "Read and write" : "Read only"}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <AgentStatus />
            <ThemeToggle />
            <Button variant="ghost" onClick={() => { saveAuthToken(null); setAuthenticated(false); qc.clear(); }}><LogOut size={14} className="mr-1.5 inline align-[-2px]" />Sign out</Button>
          </div>
        </header>
        {/* Pages fill the available width; the cap only stops lines growing unreadably long on very wide monitors. */}
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6"><div className="mx-auto w-full max-w-[1720px]"><Outlet /></div></main>
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
    <main className="star-sky relative grid min-h-full place-items-center p-5">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <section className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <OrbitMark size={64} />
          <h1 className="mt-5 font-wordmark text-[2rem] font-semibold tracking-[0.06em]">ORBIT</h1>
          <p className="mt-2 max-w-[19rem] text-balance text-sm text-muted">Search any system and explore how it works, part by part, in 3D.</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface/90 p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
          <h2 className="text-lg font-semibold">{mode === "login" ? "Sign in" : "Create your account"}</h2>
          {Boolean(error) && <div className="mt-4"><ErrorState error={error} /></div>}
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block text-sm text-muted">Email<input required type="email" autoComplete="email" className={`${inputCls} mt-1 text-text`} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block text-sm text-muted">Password<input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className={`${inputCls} mt-1 text-text`} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <Button type="submit" variant="primary" className="w-full py-2" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          {mode === "login" ? "New to ORBIT? " : "Already have an account? "}
          <button className="font-semibold text-accent hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>{mode === "login" ? "Create an account" : "Sign in"}</button>
        </p>
      </section>
    </main>
  );
}
