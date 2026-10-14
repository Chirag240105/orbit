import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./app/Shell";
import { WorkspaceProvider } from "./app/WorkspaceContext";
import { ChatPage } from "./features/chat/ChatPage";
import { HomePage } from "./features/home/HomePage";
import { MemoryPage } from "./features/memory/MemoryPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { SkillsPage } from "./features/skills/SkillsPage";
import { TasksPage } from "./features/tasks/TasksPage";
// Self-hosted fonts (FE-01): bundled by Vite, no CDN request at runtime.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./styles/index.css";

// three.js is ~1 MB: load the 3D studio only when it is opened.
const VisualLearningPage = lazy(() => import("./features/visual-learning/VisualLearningPage").then((m) => ({ default: m.VisualLearningPage })));
const MarkersPage = lazy(() => import("./features/visual-learning/MarkersPage").then((m) => ({ default: m.MarkersPage })));
const loading = <p className="text-sm text-muted">Loading…</p>;

const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <WorkspaceProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<HomePage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="visual" element={<Suspense fallback={loading}><VisualLearningPage /></Suspense>} />
              <Route path="visual/markers" element={<Suspense fallback={loading}><MarkersPage /></Suspense>} />
              <Route path="memory" element={<MemoryPage />} />
              <Route path="skills" element={<SkillsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WorkspaceProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
