# Adding a feature

1. Define the feature and its security implications (what data, what permission, what leaves the machine).
2. Add or change models in `backend/app/models.py` and schemas in `schemas.py`.
3. Implement the service logic (new module under the relevant folder; keep routes thin).
4. Add authorization and validation (permission names, size limits, path rules).
5. Add the endpoint in `api/routes.py`.
6. If the agent needs it: register a **skill** (`docs/SKILL_DEVELOPMENT.md`) or a **tool** (`tools/registry.py`, with `permissions` and `requires_confirmation`).
7. Build the screen (below).
8. Add unit and API tests; add a frontend test if there is logic.
9. Update docs and `.env.example`.
10. Update `TASKS.md` after verifying acceptance criteria.

A new skill or tool has **no** file or action rights until its permissions are declared and enforced independently.

## Frontend example: a "Notes" screen
1. `frontend/src/features/notes/NotesPage.tsx`:
```tsx
import { useQuery } from "@tanstack/react-query";
import { EmptyState, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";

export function NotesPage() {
  const { data } = useQuery({ queryKey: ["memories"], queryFn: () => api.memories("") });
  return (<div><PageHeader title="Notes" />{data?.length ? data.map((m) => <p key={m.id}>{m.content}</p>) : <EmptyState title="No notes yet" />}</div>);
}
```
2. Add `<Route path="notes" element={<NotesPage />} />` in `src/main.tsx` and `["/notes", "Notes"]` to `NAV` in `src/app/Shell.tsx`.
3. New API calls go in `src/lib/api.ts` with types in `src/types/api.ts`. Never call `fetch` from a component.
