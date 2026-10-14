import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { delay, http, HttpResponse, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "../src/app/WorkspaceContext";

/** A fake backend. Unhandled requests fail the test so every screen's calls are explicit. */
export const server = setupServer();
export const api = (path: string) => `*/api${path}`;
export const ok = (path: string, body: JsonBodyType, method: "get" | "post" | "patch" | "delete" = "get") => http[method](api(path), () => HttpResponse.json(body));
export const fail = (path: string, code: string, message: string, status = 500, method: "get" | "post" | "patch" | "delete" = "get") =>
  http[method](api(path), () => HttpResponse.json({ error: { code, message, details: null } }, { status }));
export const pending = (path: string) => http.get(api(path), async () => { await delay("infinite"); return HttpResponse.json([]); });
export const offline = (path: string) => http.get(api(path), () => HttpResponse.error());

export function sseStream(events: [string, unknown][], { holdOpen = false, gapMs = 5 } = {}) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [event, data] of events) {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        await new Promise((r) => setTimeout(r, gapMs));
      }
      if (!holdOpen) controller.close();
    },
  });
}

export const HEALTH = { status: "ok", version: "0.1.0", database: "ok", provider: { name: "demo", model: "deterministic-demo", configured: true, is_demo: true, demo_mode: true } };

export function renderPage(ui: ReactElement, { route = "/", path = "*", activeWorkspace }: { route?: string | { pathname: string; state?: unknown }; path?: string; activeWorkspace?: number } = {}) {
  if (activeWorkspace !== undefined) localStorage.setItem("orbit.activeWorkspace", String(activeWorkspace));
  else localStorage.removeItem("orbit.activeWorkspace");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes><Route path={path} element={ui} /></Routes>
        </MemoryRouter>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
}
