import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { Badge, SkipLink, cx } from "../components/ui";
import { Icon, type IconName } from "../components/icons";
import { LogoMark, Wordmark } from "../components/Logo";
import { useTheme, type ThemePref } from "./theme";
import { useActiveWorkspace } from "./WorkspaceContext";

const NAV: readonly (readonly [string, string, IconName])[] = [
  ["/", "Home", "home"], ["/chat", "AI Workspace", "chat"], ["/projects", "Projects", "folder"], ["/visual", "Visual Learning", "cube"],
  ["/memory", "Memory", "memory"], ["/skills", "Skills", "bolt"], ["/tasks", "Tasks and Plans", "tasks"], ["/settings", "Settings and Privacy", "shield"],
];

function AgentStatus() {
  const { data, isError } = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 15000 });
  if (isError) return <Badge color="danger">Backend offline</Badge>;
  if (!data) return <Badge>Checking…</Badge>;
  const p = data.provider;
  if (p.is_demo) return <Badge color="warn">Demo mode, no model</Badge>;
  if (!p.configured) return <Badge color="warn">Model not configured</Badge>;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-ok/30 bg-ok/10 px-2.5 py-1 text-xs font-medium text-ok">
      <span aria-hidden className="pulse-dot h-1.5 w-1.5 rounded-full bg-ok" />
      Model connected: {p.model.split("/").pop()}
    </span>
  );
}

const THEMES: [ThemePref, string, IconName][] = [["system", "System theme", "monitor"], ["light", "Light theme", "sun"], ["dark", "Dark theme", "moon"]];
function ThemeSwitch() {
  const [pref, setPref] = useTheme();
  return (
    <div role="group" aria-label="Color theme" className="inline-flex rounded-full border border-line bg-surface p-0.5">
      {THEMES.map(([value, label, icon]) => (
        <button key={value} type="button" aria-label={label} title={label} aria-pressed={pref === value} onClick={() => setPref(value)}
          className={cx("rounded-full p-1.5 transition-colors", pref === value ? "bg-raised text-accent" : "text-muted hover:text-text")}>
          <Icon name={icon} className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

/** The AI Workspace starts with the sidebar collapsed to an icon rail so the conversation gets the room; other pages start expanded.
 *  Each choice is remembered separately (per-browser convenience only). */
const NAV_KEY = { chat: "orbit-nav-chat", other: "orbit-nav-other" };
function readCollapsed(key: string, fallback: boolean) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === "collapsed"; } catch { return fallback; }
}
function useCollapsedNav() {
  const onChat = useLocation().pathname.startsWith("/chat");
  const [state, setState] = useState(() => ({ chat: readCollapsed(NAV_KEY.chat, true), other: readCollapsed(NAV_KEY.other, false) }));
  const which = onChat ? "chat" : "other";
  const set = (collapsed: boolean) => {
    setState((s) => ({ ...s, [which]: collapsed }));
    try { localStorage.setItem(NAV_KEY[which], collapsed ? "collapsed" : "expanded"); } catch { /* storage blocked */ }
  };
  return [state[which], set] as const;
}

export function Shell() {
  const { activeId, setActiveId } = useActiveWorkspace();
  const [collapsed, setCollapsed] = useCollapsedNav();
  const { data: workspaces } = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces });
  const active = workspaces?.find((w) => w.id === activeId);
  return (
    <div className="flex h-full flex-col md:flex-row">
      <SkipLink />
      <nav aria-label="Primary" className={cx("flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-surface/80 p-2 backdrop-blur md:flex-col md:overflow-x-visible md:border-b-0 md:border-r md:transition-[width] md:duration-200", collapsed ? "md:w-[4.25rem] md:items-center md:px-2 md:py-3" : "md:w-60 md:p-3")}>
        {collapsed ? (
          <button type="button" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" aria-expanded={false} title="Expand sidebar"
            className="mb-4 hidden rounded-xl p-1.5 transition-colors hover:bg-raised md:block">
            <LogoMark className="h-8 w-8" />
          </button>
        ) : (
          <div className="hidden px-2 pb-5 pt-2 md:block">
            <div className="flex items-center justify-between gap-2">
              <Wordmark />
              <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" aria-expanded title="Collapse sidebar"
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-raised hover:text-text">
                <Icon name="sidebar" />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">Your personal AI operating layer</p>
          </div>
        )}
        {NAV.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end={to === "/"} title={collapsed ? label : undefined} className={({ isActive }) => cx(
            "group relative flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
            collapsed && "md:justify-center md:px-0 md:py-2.5 md:w-11",
            isActive ? "bg-accent/10 font-medium text-text" : "text-muted hover:bg-raised hover:text-text",
          )}>
            {({ isActive }) => (<>
              {isActive && <span aria-hidden className={cx("absolute inset-y-1.5 hidden w-[3px] rounded-full bg-brand md:block", collapsed ? "-left-2" : "left-0")} />}
              <Icon name={icon} className={cx("h-[18px] w-[18px]", isActive ? "text-accent" : "text-muted group-hover:text-text")} />
              <span className={collapsed ? "md:sr-only" : undefined}>{label}</span>
            </>)}
          </NavLink>
        ))}
        <div className={cx("mt-auto hidden rounded-lg border border-line bg-bg/60 p-3 text-xs", !collapsed && "md:block")}>
          <p className="font-medium text-text">Powered by NVIDIA Nemotron</p>
          <p className="mt-0.5 text-muted">Inference on Nebius Token Factory</p>
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/60 px-4 py-2.5 text-sm backdrop-blur md:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-muted">Workspace</span>
            <select aria-label="Active workspace" value={activeId ?? ""} onChange={(e) => setActiveId(e.target.value ? Number(e.target.value) : null)} className="max-w-[12rem] rounded-lg border border-line bg-bg px-2.5 py-1 hover:border-muted">
              <option value="">None authorized</option>
              {workspaces?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {active && <Badge color={active.allow_write ? "warn" : "ok"}>{active.allow_write ? "Read and write" : "Read only"}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <AgentStatus />
            <ThemeSwitch />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 focus:outline-none md:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
