/**
 * DebugPanel — shows per-turn NVIDIA model telemetry for judges and developers.
 *
 * Displayed in the Settings page and optionally as a floating overlay.
 * Shows: provider, endpoint host, model ID, latency, tokens, memories, tool calls, fallback used.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface TurnDebug {
  timestamp?: string;
  provider?: string;
  endpoint?: string;
  model?: string;
  latency_ms?: number;
  tokens?: { prompt?: number; completion?: number };
  total_latency_ms?: number;
  skill?: string;
  intent?: string;
  retrieved_memory_ids?: number[];
  tool_calls?: { name: string; status: string }[];
  fallback_used?: boolean;
}

function modelShort(model: string | undefined): string {
  if (!model) return "—";
  // e.g. nvidia/nemotron-3.5-super-vl-120b-a12b -> nemotron-3.5-super
  const parts = model.split("/");
  const name = parts[parts.length - 1];
  return name.replace(/-[a-z0-9]+-[a-z0-9]+$/, ""); // strip parameter suffix
}

function endpointHost(endpoint: string | undefined): string {
  if (!endpoint) return "—";
  try { return new URL(endpoint).host; } catch { return endpoint; }
}

export function DebugPanel() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["debug-turns"],
    queryFn: api.debugTurns,
    refetchInterval: 5000,
  });

  const turns = (data as TurnDebug[] | undefined) ?? [];
  const recent = [...turns].reverse().slice(0, 8);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted">
          Live telemetry from the NVIDIA Nemotron model gateway. Updates every 5 s.
        </p>
        <button
          onClick={() => refetch()}
          className="text-[11px] text-accent hover:underline"
        >
          Refresh
        </button>
      </div>
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {!isLoading && recent.length === 0 && (
        <p className="text-sm text-muted">
          No recent turns. Send a message in AI Workspace to see model telemetry here.
        </p>
      )}
      {recent.map((turn, i) => (
        <details key={i} className="mb-2 rounded-lg border border-line bg-bg" open={i === 0}>
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 rounded-full bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] text-accent font-semibold">
                {turn.provider ?? "?"}
              </span>
              <span className="truncate font-medium text-text">{modelShort(turn.model)}</span>
              {turn.intent && (
                <span className="rounded bg-raised px-1.5 py-0.5 text-muted">{turn.intent}</span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 text-muted">
              {turn.total_latency_ms != null && (
                <span className="font-mono">{turn.total_latency_ms} ms</span>
              )}
              {turn.tokens && (
                <span className="font-mono">
                  {(turn.tokens.prompt ?? 0) + (turn.tokens.completion ?? 0)} tok
                </span>
              )}
            </div>
          </summary>
          <div className="border-t border-line px-3 py-2 text-[11px] space-y-1">
            <div className="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-0.5">
              <span className="text-muted">Provider</span>
              <span className="font-medium">{turn.provider ?? "—"}</span>
              <span className="text-muted">Endpoint</span>
              <span className="font-mono">{endpointHost(turn.endpoint)}</span>
              <span className="text-muted">Model ID</span>
              <span className="font-mono text-accent">{turn.model ?? "—"}</span>
              <span className="text-muted">Skill</span>
              <span>{turn.skill ?? "—"}</span>
              <span className="text-muted">Latency</span>
              <span className="font-mono">
                {turn.total_latency_ms != null ? `${turn.total_latency_ms} ms total` : "—"}
                {turn.latency_ms != null && turn.latency_ms !== turn.total_latency_ms
                  ? ` (model ${turn.latency_ms} ms)`
                  : ""}
              </span>
              <span className="text-muted">Tokens</span>
              <span className="font-mono">
                {turn.tokens
                  ? `${turn.tokens.prompt ?? "?"} prompt + ${turn.tokens.completion ?? "?"} completion`
                  : "—"}
              </span>
              <span className="text-muted">Memories</span>
              <span>
                {turn.retrieved_memory_ids?.length
                  ? `${turn.retrieved_memory_ids.length} retrieved`
                  : "none"}
              </span>
              {turn.tool_calls && turn.tool_calls.length > 0 && (
                <>
                  <span className="text-muted">Tools</span>
                  <span>{turn.tool_calls.map((t) => `${t.name}:${t.status}`).join(", ")}</span>
                </>
              )}
              {turn.timestamp && (
                <>
                  <span className="text-muted">Time</span>
                  <span>{new Date(turn.timestamp).toLocaleTimeString()}</span>
                </>
              )}
            </div>
          </div>
        </details>
      ))}
      <p className="mt-2 text-[10px] text-muted">
        ORBIT uses NVIDIA's Nemotron models: MODEL_PLANNER for explanations and planning,
        MODEL_FAST for intent classification, MODEL_EMBED for memory retrieval.
        Fallback chain: Planner → Fallback → Fast (non-JSON) → service unavailable.
      </p>
    </div>
  );
}
