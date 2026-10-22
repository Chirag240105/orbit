import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./app/Shell";
import { WorkspaceProvider } from "./app/WorkspaceContext";
import { PageLoader } from "./components/ui";
import { HomePage } from "./features/home/HomePage";
import "./styles/index.css";

// Lazy-load feature pages so Three.js, MediaPipe, and other heavy deps
// only download when the user navigates to that route.
const ChatPage = lazy(() => import("./features/chat/ChatPage").then((m) => ({ default: m.ChatPage })));
const ProjectsPage = lazy(() => import("./features/projects/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const VisualLearningPage = lazy(() => import("./vision/VisualLearningPage").then((m) => ({ default: m.VisualLearningPage })));
const MemoryPage = lazy(() => import("./features/memory/MemoryPage").then((m) => ({ default: m.MemoryPage })));
const SkillsPage = lazy(() => import("./features/skills/SkillsPage").then((m) => ({ default: m.SkillsPage })));
const TasksPage = lazy(() => import("./features/tasks/TasksPage").then((m) => ({ default: m.TasksPage })));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <WorkspaceProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<HomePage />} />
              <Route path="chat" element={<Suspense fallback={<PageLoader />}><ChatPage /></Suspense>} />
              <Route path="projects" element={<Suspense fallback={<PageLoader />}><ProjectsPage /></Suspense>} />
              <Route path="visual" element={<Suspense fallback={<PageLoader />}><VisualLearningPage /></Suspense>} />
              <Route path="memory" element={<Suspense fallback={<PageLoader />}><MemoryPage /></Suspense>} />
              <Route path="skills" element={<Suspense fallback={<PageLoader />}><SkillsPage /></Suspense>} />
              <Route path="tasks" element={<Suspense fallback={<PageLoader />}><TasksPage /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WorkspaceProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
