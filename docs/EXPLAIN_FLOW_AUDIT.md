# Explain Flow Audit — Visual Learning Studio

**Date:** 2026-10-30  
**Audited files:** `frontend/src/vision/VisualLearningPage.tsx`, `ExplainDrawer.tsx`, `SceneCanvas.tsx`, `CameraPanel.tsx`, `gestures.ts`, `frontend/src/lib/api.ts`

---

## Summary of findings

The event-to-network map below covers every path from user or gesture action to a network call.
The **one auto-trigger that violates the spec** is highlighted.

---

## Event → Network map

| Trigger | Path | Network call | Verdict |
|---|---|---|---|
| Mouse click on part | `Part.onClick` → `SceneCanvas.onSelect` → `choose(id)` = `setSelected(id)` | None | ✅ OK |
| Hand dwell / tap on part | `HandPointer.useFrame` → `onHandSelect(id, via)` → `choose(id)` or `goStep(i)` | None | ✅ OK |
| Swipe gesture | `handleHandEvent({ type:"swipe" })` → `choose(id)` or `goStep(i)` | None | ✅ OK |
| Open-palm hold | `handleHandEvent({ type:"hold", pose:"open" })` → reset state setters | None | ✅ OK |
| Thumbs-up hold | `handleHandEvent({ type:"hold", pose:"thumbs_up" })` → `remember.mutate()` | `POST /vision/context` (memory save, **not chat**) | ✅ OK — deliberate gesture |
| "Explain" button click | `setDrawerOpen(true)` → ExplainDrawer receives `open=true` | See row below | → |
| ExplainDrawer `useEffect` on `[open, context.sceneTitle, context.label]` | Fires when `open=true` AND context key changed → `sendMessage(buildPrompt(context), null, [])` → `chatStream` → `WebSocket /ws/chat` | `WebSocket /ws/chat` | ❌ **VIOLATION — auto-sends without user pressing Send** |
| ExplainDrawer Send button | `handleSubmit` → `sendMessage(input, convId, messages)` | `WebSocket /ws/chat` | ✅ OK — explicit user action |
| "Remember" button in panel | `remember.mutate(content)` | `POST /vision/context` | ✅ OK |
| "Add to Project" button | `remember.mutate(content)` | `POST /vision/context` | ✅ OK |
| "Save" button in drawer | `saveLastAnswer()` → `api.addMemory()` | `POST /memories` | ✅ OK |
| Topic search form | `generate.mutate(topic)` | `POST /vision/scene` | ✅ OK |

---

## Invariants confirmed

- `choose(id)` and `goStep(i)` are pure state setters. No network calls.
- No `useEffect` in `VisualLearningPage` depends on `selected`, `isolated`, `learning`, or any gesture/hand state and fires a network call.
- No `useNavigate` or `<Link to="/chat">` exists in any of the vision files.
- Gesture callbacks (`handleHandEvent`, `handSelect`) have no code path to `setDrawerOpen`, `sendMessage`, or `chatStream`.
- The "Explain" button is the only place that sets `drawerOpen = true`.

---

## Fix applied

**Removed** the `useEffect` in `ExplainDrawer.tsx` that auto-called `sendMessage` on open.

**Replaced with:** On open + context key change, set `draft` to the pre-built prompt string. The text input is focused and pre-filled. **Nothing is sent until the user presses Send.**

Additional changes made to satisfy the full spec:
- `AbortController` + Stop button to cancel in-flight stream.
- `isTrusted` guard on Explain button's `onClick` in `VisualLearningPage`.
- Context chip showing current scene + part with "Nothing is sent until you press Send."
- "Use this part" button when a different part is selected while the window is open.
- Separate `draft` state from sent messages so selecting another part never overwrites what the user has typed.
