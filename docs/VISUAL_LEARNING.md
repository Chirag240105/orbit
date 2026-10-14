# Visual Learning Studio

| Part | Status |
|---|---|
| Curated 3D scene (three-tier cloud app, 9 components, step-by-step mode, isolate, reset, labels) | Built with React Three Fiber; data tests pass; **not visually checked in a browser by the author of this scaffold** |
| Camera preview with consent, indicator, stop button | Built with `getUserMedia`; **not tested on a real device** |
| Subject selection | Manual tabs. Two subjects are marked Planned and show an unsupported state |
| Recognition from the camera (OpenCV / MediaPipe) | **Not implemented.** Camera and 3D scene are separate modules. Tasks CV-01, CV-02 |
| AI explanations of components | Curated text only. "Ask ORBIT in chat" sends a prefilled question |

Honest scope: OpenCV cannot reconstruct arbitrary objects into 3D. The realistic path is recognizing known markers or subjects (CV-01), then loading a curated scene. Add a scene in `features/visual-learning/scenes.ts` (components need unique ids, explanations, and valid `connectsTo`; the data test enforces this).
