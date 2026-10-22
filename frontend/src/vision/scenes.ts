export type SceneComponent = {
  id: string; label: string; shape: "box" | "cylinder" | "sphere"; position: [number, number, number];
  size: [number, number, number]; color: string; zone: "internet" | "vpc"; summary: string; details: string; step: number; connectsTo: string[];
};
export type Scene = { id: string; title: string; description: string; components: SceneComponent[] };
export type Subject = { id: string; title: string; supported: boolean; scene?: Scene; note?: string };

const c = (x: SceneComponent) => x;

export const threeTierScene: Scene = {
  id: "three-tier-web-app",
  title: "Three-tier web app on the cloud",
  description: "A curated, hand-built scene. Traffic flows from users at the front, through the edge and load balancer, to app servers, then to data stores.",
  components: [
    c({ id: "frontend", label: "Frontend", shape: "box", position: [0, 0.5, 4], size: [2, 0.8, 1], color: "#6c9eff", zone: "internet", step: 1, connectsTo: ["api"], summary: "The browser interface a person interacts with.", details: "The frontend renders screens, collects input, and calls the backend over HTTPS. It should not contain provider keys or make privileged database writes directly." }),
    c({ id: "api", label: "API", shape: "box", position: [0, 0.5, 1.8], size: [2, 0.8, 1], color: "#5fc59a", zone: "vpc", step: 2, connectsTo: ["agent"], summary: "Authenticates requests and enforces access rules.", details: "The API validates input, checks the signed-in user, applies rate limits, and records sensitive actions. It forms the controlled boundary between the browser and application services." }),
    c({ id: "agent", label: "Agent", shape: "box", position: [0, 0.5, -0.5], size: [2, 0.9, 1.2], color: "#e3b25c", zone: "vpc", step: 3, connectsTo: ["memory", "nebius"], summary: "Plans work and chooses permission-checked tools.", details: "The agent uses approved context to answer or prepare actions. Reads are audited; writes wait for explicit confirmation, so the model cannot directly change files or records." }),
    c({ id: "memory", label: "Memory", shape: "cylinder", position: [-2.3, 0.6, -3], size: [1, 1.2, 1], color: "#c792ea", zone: "vpc", step: 4, connectsTo: [], summary: "Stores user-approved facts and project context.", details: "Memory is user scoped and can be confirmed, edited, or deleted. Retrieval adds only relevant approved records to a request." }),
    c({ id: "nebius", label: "Nebius", shape: "sphere", position: [2.3, 0.7, -3], size: [0.85, 0.85, 0.85], color: "#4fb3c9", zone: "internet", step: 5, connectsTo: [], summary: "Hosted model provider for language tasks.", details: "Only the prompt and context needed for a request leave the app, after redaction and consent where workspace files are involved. Provider keys stay on the backend." }),
  ],
};

export const subjects: Subject[] = [
  { id: threeTierScene.id, title: threeTierScene.title, supported: true, scene: threeTierScene },
  { id: "kubernetes", title: "Kubernetes cluster", supported: false, note: "Planned. Needs a curated scene for pods, nodes and the control plane." },
  { id: "neural-network", title: "Neural network layers", supported: false, note: "Planned. Needs a curated scene for layers, weights and activations." },
];

export const stepsOf = (s: Scene) => [...s.components].sort((a, b) => a.step - b.step);
