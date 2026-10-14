# Visual Learning Studio

| Part | Status |
|---|---|
| Curated 3D scenes: three-tier cloud app (9 parts) and event-driven serverless app (10 parts) | Built with React Three Fiber; step mode, isolate, view presets (overview/top/front), labels. **Verified in Edge** (rendering, screenshots, no horizontal scroll at 360–1280 px). Not tried on phones |
| No-WebGL state | Detected up front, plus an error boundary; verified in Edge with WebGL disabled. Parts list and explanations keep working |
| Camera preview with consent, indicator, stop button | `getUserMedia`; verified in Edge with a fake camera. Not tested on a physical webcam |
| Marker recognition (CV-01) | **Built.** Printed ArUco markers (ARUCO_MIP_36h12, ids 1 and 2) select a scene. Detection runs in the browser (js-aruco2) every 250 ms on a downscaled in-memory frame; a marker must be seen in 3 consecutive frames. Verified end to end in Edge by feeding the fake camera a video of marker #2. Print them at `/visual/markers` |
| AI explanation of a selected part (AI-09) | **Built.** "Explain more with AI" calls `POST /api/learn/explain`; labeled "AI-generated" with the model name, or "Curated text (no model)" in demo/unconfigured mode |
| Gesture control with MediaPipe (CV-02) | **Not built.** It needs a real camera and hand to verify, and a ~8 MB model that must be bundled to stay offline |
| Subjects not supported yet | Kubernetes, neural networks: shown as Planned with an explanation |

Honest scope: this is **marker** recognition, not object recognition. OpenCV-style pipelines cannot turn arbitrary objects into accurate 3D models; ORBIT recognizes its own printed markers and loads a curated scene.

**Add a scene** in `features/visual-learning/scenes.ts`: unique component ids, `summary` and `details` text, valid `connectsTo`, steps numbered 1..n, a `region`, a `camera`, and an unused `markerId`. Add it to `scenes` and `subjects`. `tests/lib.test.ts` checks all of this for every scene, and the markers page picks it up automatically.
