# ORBIT frontend

React 18 + TypeScript + Vite + Tailwind v4 + TanStack Query + React Router + React Three Fiber.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api to 127.0.0.1:8000 and adds the local API token
npm run typecheck && npm test && npm run build
npm run gen:types  # regenerate src/types/generated.ts from the backend's OpenAPI snapshot
npm run e2e        # browser smoke test against a running app (see docs/TESTING.md)
```

| Folder | Responsibility |
|---|---|
| `src/app` | Shell (sidebar, top bar, skip link) and workspace context |
| `src/components` | Design primitives (`ui.tsx`), `ConsentDialog`, `FilePicker` |
| `src/features/<name>` | One folder per screen; keep feature code inside it |
| `src/lib/api.ts` | The only place that calls `fetch`, including the streaming chat client |
| `src/lib` | `sse.ts` (event-stream parser), `preview.ts` (readable partial answers), `diff.ts`, `errors.ts` (error titles and recovery steps), `markers.ts` (ArUco detection) |
| `src/types` | `generated.ts` (from the backend contract, do not edit), `api.ts` (short names), `js-aruco2.d.ts` |
| `src/styles/index.css` | Design tokens (`@theme`), self-hosted fonts are imported in `main.tsx` |
| `tests/` | Vitest + Testing Library + MSW (`helpers.tsx` is the fake backend) |
| `e2e/smoke.mjs` | Real-browser smoke test (Playwright core, Edge or Chrome) |

The Visual Learning Studio (and three.js) is lazy-loaded, so other screens don't download the 3D bundle. Add a screen: see `docs/EXTENDING.md`. Design rules: `docs/UI_UX_GUIDE.md`.
