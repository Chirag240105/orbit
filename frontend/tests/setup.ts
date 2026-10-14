import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./helpers";

// Test-environment shim: jsdom provides AbortController, but fetch is Node's (undici), which rejects a signal
// from another realm. Re-implement abort on top of Node's fetch: abort rejects the pending fetch, or errors the
// body stream mid-read, with an AbortError, just as browsers do. App code is unchanged. Installed after MSW so it
// wraps MSW's fetch (MSW builds a Request from init, which would hit the same realm check).
const withAbort = (nodeFetch: typeof fetch) => (input: RequestInfo | URL, init?: RequestInit) => {
  const signal = init?.signal;
  if (!signal) return nodeFetch(input, init);
  const rest = { ...init, signal: undefined };
  const aborted = new Promise<never>((_, reject) => {
    const fire = () => reject(new DOMException("The operation was aborted.", "AbortError"));
    if (signal.aborted) fire();
    else signal.addEventListener("abort", fire, { once: true });
  });
  aborted.catch(() => {});
  return Promise.race([nodeFetch(input, rest), aborted]).then((res) => {
    if (!res.body) return res;
    const reader = res.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await Promise.race([reader.read(), aborted]);
        if (done) controller.close();
        else controller.enqueue(value);
      },
      cancel: (reason) => reader.cancel(reason),
    });
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  });
};

// jsdom has no canvas; report "no context" quietly so the WebGL probe takes its fallback path.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  globalThis.fetch = withAbort(globalThis.fetch);
});
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());
