# ORBIT frontend

React 18 + TypeScript + Vite + Tailwind v4 + TanStack Query + React Router + React Three Fiber.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api to 127.0.0.1:8000
npm run typecheck && npm test && npm run build
```

| Folder | Responsibility |
|---|---|
| `src/app` | Shell (sidebar, top bar) and workspace context |
| `src/components/ui.tsx` | Design primitives: Button, Panel, Badge, EmptyState, ErrorState, ConfirmDialog… |
| `src/features/<name>` | One folder per screen; keep feature code inside it |
| `src/lib/api.ts` | The only place that calls `fetch`; typed with `src/types/api.ts` |
| `src/styles/index.css` | Design tokens (`@theme`) |

Add a screen: see `docs/EXTENDING.md`.
