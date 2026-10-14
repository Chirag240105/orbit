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
    c({ id: "users", label: "Users", shape: "sphere", position: [0, 0.5, 7], size: [0.6, 0.6, 0.6], color: "#8a94aa", zone: "internet", step: 1, connectsTo: ["cdn"], summary: "Browsers and phones that send requests.", details: "Everything starts with a request from a person's device. Each request crosses the public internet, so the first design questions are latency and trust: how close are your servers, and what do you assume about the sender?" }),
    c({ id: "cdn", label: "CDN / edge cache", shape: "box", position: [0, 0.5, 5], size: [1.8, 0.7, 0.8], color: "#6c9eff", zone: "internet", step: 2, connectsTo: ["lb"], summary: "Serves static files from a location near the user.", details: "A content delivery network caches images, scripts and pages in many cities. Cache hits never reach your servers, which cuts latency and load. Only misses and dynamic requests continue inward." }),
    c({ id: "lb", label: "Load balancer", shape: "box", position: [0, 0.5, 3], size: [2.2, 0.7, 0.8], color: "#5fc59a", zone: "vpc", step: 3, connectsTo: ["app1", "app2"], summary: "Spreads requests across healthy app servers.", details: "The load balancer is the single public entry into your private network. It health-checks servers, stops sending traffic to failed ones, and can terminate TLS. Without it, one server failure takes the whole app down." }),
    c({ id: "app1", label: "App server A", shape: "box", position: [-2, 0.5, 1], size: [1.5, 1, 1.2], color: "#e3b25c", zone: "vpc", step: 4, connectsTo: ["cache", "db"], summary: "Runs your application code (copy 1 of 2).", details: "App servers hold your business logic and are kept stateless, meaning no user data lives only on one machine. That is what lets you add or remove copies freely (horizontal scaling)." }),
    c({ id: "app2", label: "App server B", shape: "box", position: [2, 0.5, 1], size: [1.5, 1, 1.2], color: "#e3b25c", zone: "vpc", step: 5, connectsTo: ["cache", "db"], summary: "Runs your application code (copy 2 of 2).", details: "A second identical copy, ideally in a different availability zone (a physically separate data center), so a power or network failure in one zone doesn't stop the app." }),
    c({ id: "cache", label: "In-memory cache", shape: "box", position: [0, 0.5, -1.2], size: [1.4, 0.6, 0.8], color: "#c792ea", zone: "vpc", step: 6, connectsTo: [], summary: "Keeps hot data in memory so the database is asked less.", details: "Tools like Redis hold frequently read results (sessions, product lists). Reading from memory takes microseconds versus milliseconds for disk. The trade-off: cached data can be slightly stale, so you decide when it expires." }),
    c({ id: "db", label: "Primary database", shape: "cylinder", position: [-2, 0.6, -3.6], size: [0.9, 1.2, 0.9], color: "#f0706a", zone: "vpc", step: 7, connectsTo: ["replica"], summary: "The source of truth. All writes go here.", details: "The primary database stores durable data and accepts every write. It sits in a private subnet with no public address, so it can only be reached from the app servers." }),
    c({ id: "replica", label: "Read replica", shape: "cylinder", position: [2, 0.6, -3.6], size: [0.9, 1.2, 0.9], color: "#f59c97", zone: "vpc", step: 8, connectsTo: [], summary: "A synchronized copy used for reads and failover.", details: "The replica receives changes from the primary. It takes read traffic off the primary and can be promoted if the primary fails. Replication has a small delay, so a read right after a write may not see it yet." }),
    c({ id: "storage", label: "Object storage", shape: "box", position: [5, 0.4, 1], size: [1.4, 0.5, 1.4], color: "#4fb3c9", zone: "vpc", step: 9, connectsTo: [], summary: "Cheap, durable storage for files like uploads and backups.", details: "Services like S3 store large files as objects rather than rows. Apps read and write them through an API, and the CDN can serve them directly to users. Databases are the wrong place for big files." }),
  ],
};

export const subjects: Subject[] = [
  { id: threeTierScene.id, title: threeTierScene.title, supported: true, scene: threeTierScene },
  { id: "kubernetes", title: "Kubernetes cluster", supported: false, note: "Planned. Needs a curated scene for pods, nodes and the control plane." },
  { id: "neural-network", title: "Neural network layers", supported: false, note: "Planned. Needs a curated scene for layers, weights and activations." },
];

export const stepsOf = (s: Scene) => [...s.components].sort((a, b) => a.step - b.step);
