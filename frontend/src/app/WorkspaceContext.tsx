import { createContext, useContext, useState, type ReactNode } from "react";

type Ctx = { activeId: number | null; setActiveId: (id: number | null) => void };
const C = createContext<Ctx>({ activeId: null, setActiveId: () => {} });
const KEY = "orbit.activeWorkspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeId, set] = useState<number | null>(() => {
    try { const v = localStorage.getItem(KEY); return v ? Number(v) : null; } catch { return null; }
  });
  const setActiveId = (id: number | null) => {
    set(id);
    try { id === null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, String(id)); } catch { /* storage unavailable */ }
  };
  return <C.Provider value={{ activeId, setActiveId }}>{children}</C.Provider>;
}
export const useActiveWorkspace = () => useContext(C);
