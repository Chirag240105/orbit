# Visual Learning Studio

| Part | Status |
|---|---|
| Curated 3D scene (three-tier cloud app, 9 components, step-by-step mode, isolate, reset, labels) | Built with React Three Fiber; data tests pass; **not visually checked in a browser by the author of this scaffold** |
| Camera preview with consent, indicator, stop button | Built with `getUserMedia`; **not tested on a real device** |
| Subject selection | Manual tabs. Two subjects are marked Planned and show an unsupported state |
| Recognition from the camera (OpenCV / MediaPipe) | **Not implemented.** Camera and 3D scene are separate modules. Tasks CV-01, CV-02 |
| AI explanations of components | Curated text only. "Ask ORBIT in chat" sends a prefilled question |

Honest scope: OpenCV cannot reconstruct arbitrary objects into 3D. The realistic path is recognizing known markers or subjects (CV-01), then loading a curated scene. Add a scene in `features/visual-learning/scenes.ts` (components need unique ids, explanations, and valid `connectsTo`; the data test enforces this).

## Component models

Each scene component is drawn as a stylized procedural 3D model (no downloaded assets) chosen by its optional `kind` field in `vision/scenes.ts`, for example `gateway`, `service`, `database`, `cache`, `queue`, `agent`, `ai`, `security` or `payment`. The full list is `componentKinds`. Without a `kind`, the model falls back to one derived from `shape` (cylinder → database, sphere → person, box → service). Models live in `vision/models.tsx` and share four per-part materials (graphite body, tinted trim, neon accent, glass), so selection, hover and isolation restyle the whole model.

The scene also draws curved connections with packets flowing from source to target, a private-network (VPC) platform sized from the `vpc` components, and a camera that frames the scene on load and glides to the selected part. Idle animation, packet motion and camera transitions are disabled when the viewer prefers reduced motion.

## Hand gestures

Start hand tracking with **Hand control** on the scene (or **Start** in the Hand gestures panel). A mirrored preview with the tracked hand skeleton appears inside the scene, so it also works in full screen, and a cursor follows your index fingertip.

| Gesture | Action |
|---|---|
| Point and hold (about 0.65 s) | Select the part under the cursor; the cursor ring fills while you hold |
| Pinch and drag | Rotate the scene |
| Quick pinch and release | Select the part under the cursor |
| Swipe left or right | Previous or next part, or tour step while touring |
| Hold an open palm (1 s) | Reset the view and clear the selection |
| Hold a thumbs up (0.7 s) | Remember the selected part as a `VISION` memory |

The gesture logic lives in `GestureEngine` (`vision/gestures.ts`). It is pure and time-driven, so `tests/gesture-engine.test.ts` drives it with recorded landmark fixtures. Pose detection compares fingertip and joint distances from the wrist, so it tolerates tilted hands. The 3D scene raycasts the cursor to find the part under it.
