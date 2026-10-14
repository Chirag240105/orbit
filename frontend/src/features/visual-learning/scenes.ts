export type Vec3 = [number, number, number];
export type SceneComponent = {
  id: string; label: string; shape: "box" | "cylinder" | "sphere"; position: Vec3;
  size: Vec3; color: string; summary: string; details: string; step: number; connectsTo: string[];
};
export type Scene = {
  id: string; title: string; description: string; components: SceneComponent[];
  /** Shaded area behind the components (a network boundary or a provider's managed services). */
  /** labelAt: where the region label sits (default: front-left corner). */
  region: { label: string; center: Vec3; size: [number, number]; labelAt?: Vec3 };
  camera: { position: Vec3; target: Vec3 };
  /** ArUco marker (ARUCO_MIP_36h12 dictionary) that selects this scene from the camera (CV-01). */
  markerId: number;
};
export type Subject = { id: string; title: string; supported: boolean; scene?: Scene; note?: string };

const c = (x: SceneComponent) => x;

export const threeTierScene: Scene = {
  id: "three-tier-web-app",
  title: "Three-tier web app on the cloud",
  description: "A curated, hand-built scene. Traffic flows from users at the front, through the edge and load balancer, to app servers, then to data stores.",
  region: { label: "Private network (VPC)", center: [0, -0.05, -0.8], size: [12, 9.5] },
  camera: { position: [7, 6.5, 10.5], target: [0, 0.5, 1] },
  markerId: 1,
  components: [
    c({ id: "users", label: "Users", shape: "sphere", position: [0, 0.5, 7], size: [0.6, 0.6, 0.6], color: "#8a94aa", step: 1, connectsTo: ["cdn"], summary: "Browsers and phones that send requests.", details: "Everything starts with a request from a person's device. Each request crosses the public internet, so the first design questions are latency and trust: how close are your servers, and what do you assume about the sender?" }),
    c({ id: "cdn", label: "CDN / edge cache", shape: "box", position: [0, 0.5, 5], size: [1.8, 0.7, 0.8], color: "#6c9eff", step: 2, connectsTo: ["lb"], summary: "Serves static files from a location near the user.", details: "A content delivery network caches images, scripts and pages in many cities. Cache hits never reach your servers, which cuts latency and load. Only misses and dynamic requests continue inward." }),
    c({ id: "lb", label: "Load balancer", shape: "box", position: [0, 0.5, 3], size: [2.2, 0.7, 0.8], color: "#5fc59a", step: 3, connectsTo: ["app1", "app2"], summary: "Spreads requests across healthy app servers.", details: "The load balancer is the single public entry into your private network. It health-checks servers, stops sending traffic to failed ones, and can terminate TLS. Without it, one server failure takes the whole app down." }),
    c({ id: "app1", label: "App server A", shape: "box", position: [-2, 0.5, 1], size: [1.5, 1, 1.2], color: "#e3b25c", step: 4, connectsTo: ["cache", "db"], summary: "Runs your application code (copy 1 of 2).", details: "App servers hold your business logic and are kept stateless, meaning no user data lives only on one machine. That is what lets you add or remove copies freely (horizontal scaling)." }),
    c({ id: "app2", label: "App server B", shape: "box", position: [2, 0.5, 1], size: [1.5, 1, 1.2], color: "#e3b25c", step: 5, connectsTo: ["cache", "db"], summary: "Runs your application code (copy 2 of 2).", details: "A second identical copy, ideally in a different availability zone (a physically separate data center), so a power or network failure in one zone doesn't stop the app." }),
    c({ id: "cache", label: "In-memory cache", shape: "box", position: [0, 0.5, -1.2], size: [1.4, 0.6, 0.8], color: "#c792ea", step: 6, connectsTo: [], summary: "Keeps hot data in memory so the database is asked less.", details: "Tools like Redis hold frequently read results (sessions, product lists). Reading from memory takes microseconds versus milliseconds for disk. The trade-off: cached data can be slightly stale, so you decide when it expires." }),
    c({ id: "db", label: "Primary database", shape: "cylinder", position: [-2, 0.6, -3.6], size: [0.9, 1.2, 0.9], color: "#f0706a", step: 7, connectsTo: ["replica"], summary: "The source of truth. All writes go here.", details: "The primary database stores durable data and accepts every write. It sits in a private subnet with no public address, so it can only be reached from the app servers." }),
    c({ id: "replica", label: "Read replica", shape: "cylinder", position: [2, 0.6, -3.6], size: [0.9, 1.2, 0.9], color: "#f59c97", step: 8, connectsTo: [], summary: "A synchronized copy used for reads and failover.", details: "The replica receives changes from the primary. It takes read traffic off the primary and can be promoted if the primary fails. Replication has a small delay, so a read right after a write may not see it yet." }),
    c({ id: "storage", label: "Object storage", shape: "box", position: [5, 0.4, 1], size: [1.4, 0.5, 1.4], color: "#4fb3c9", step: 9, connectsTo: [], summary: "Cheap, durable storage for files like uploads and backups.", details: "Services like S3 store large files as objects rather than rows. Apps read and write them through an API, and the CDN can serve them directly to users. Databases are the wrong place for big files." }),
  ],
};

export const serverlessScene: Scene = {
  id: "event-driven-serverless",
  title: "Event-driven serverless app",
  description: "A curated, hand-built scene of an online order. A request becomes an event, and independent functions react to it, so slow work never blocks the user.",
  region: { label: "Cloud provider (managed services, no servers to run)", center: [0.75, -0.05, 0.4], size: [13, 12.5], labelAt: [1.6, 0.1, 6.3] },
  camera: { position: [3.5, 10.5, 15.5], target: [0.5, 0.5, 2.3] },
  markerId: 2,
  components: [
    c({ id: "client", label: "Shop app", shape: "sphere", position: [0, 0.5, 8], size: [0.6, 0.6, 0.6], color: "#8a94aa", step: 1, connectsTo: ["gateway"], summary: "A web or mobile app placing an order.", details: "The user taps 'Buy'. The app sends one HTTPS request with the cart and a login token, then waits only for a short confirmation, not for payment, emails or shipping." }),
    c({ id: "gateway", label: "API gateway", shape: "box", position: [0, 0.5, 5.6], size: [2.2, 0.7, 0.8], color: "#6c9eff", step: 2, connectsTo: ["auth", "orders"], summary: "The managed front door: routing, auth checks, throttling.", details: "The gateway receives every API call, checks the token, applies rate limits, and routes the request to the right function. You configure it instead of running a web server, and you pay per request." }),
    c({ id: "auth", label: "Identity provider", shape: "box", position: [-4, 0.5, 5.6], size: [1.6, 0.7, 0.8], color: "#9fb4d8", step: 3, connectsTo: [], summary: "Issues and verifies login tokens.", details: "A managed identity service (like Cognito or Auth0) signs tokens when users log in. The gateway verifies the signature on each call, so functions can trust who the user is without storing passwords." }),
    c({ id: "orders", label: "Order function", shape: "box", position: [0, 0.5, 3], size: [1.6, 0.9, 1], color: "#e3b25c", step: 4, connectsTo: ["table", "bus"], summary: "Short code that saves the order and announces it.", details: "A function runs only when called, scales from zero to thousands of copies automatically, and stops when done. This one validates the cart, writes the order, publishes an 'OrderPlaced' event, and replies within milliseconds." }),
    c({ id: "table", label: "Orders table (NoSQL)", shape: "cylinder", position: [-3.5, 0.6, 1], size: [0.9, 1.2, 0.9], color: "#f0706a", step: 5, connectsTo: [], summary: "A managed key-value database for orders.", details: "Tables like DynamoDB scale automatically and are billed per request. You design keys around how you read the data (for example, all orders of one customer), because joins across tables are expensive." }),
    c({ id: "bus", label: "Event bus", shape: "box", position: [3, 0.5, 1], size: [2.4, 0.5, 0.8], color: "#5fc59a", step: 6, connectsTo: ["queue", "email"], summary: "Delivers each event to every service that subscribed.", details: "The order function doesn't know who cares about new orders. The bus fans the event out to subscribers by rules. New features subscribe without touching existing code; that loose coupling is the point of event-driven design." }),
    c({ id: "queue", label: "Queue", shape: "box", position: [5, 0.5, -1.4], size: [1.6, 0.5, 0.8], color: "#c792ea", step: 7, connectsTo: ["worker"], summary: "Holds work until a worker is ready, and retries failures.", details: "A queue absorbs bursts: if 10,000 orders arrive at once, they wait safely instead of overloading the warehouse system. Messages that keep failing move to a dead-letter queue for a human to inspect." }),
    c({ id: "worker", label: "Fulfilment worker", shape: "box", position: [5, 0.5, -3.8], size: [1.6, 0.9, 1], color: "#e3b25c", step: 8, connectsTo: ["receipts"], summary: "Processes queued orders at a steady pace.", details: "This function pulls orders from the queue, charges the payment and books shipping. Because the user already got a reply, slow steps here never make the app feel slow. Work must be idempotent: running it twice must not charge twice." }),
    c({ id: "email", label: "Email function", shape: "box", position: [1.2, 0.5, -1.8], size: [1.5, 0.9, 1], color: "#e3b25c", step: 9, connectsTo: [], summary: "Sends the confirmation email.", details: "A separate subscriber to the same event. If the email service is down, only emails are delayed and retried; orders keep flowing. Independent failure is a key benefit of splitting work into small functions." }),
    c({ id: "receipts", label: "Object storage", shape: "box", position: [2, 0.4, -4.4], size: [1.4, 0.5, 1.4], color: "#4fb3c9", step: 10, connectsTo: [], summary: "Stores generated receipts and invoices as files.", details: "The worker writes each PDF receipt to object storage. Files are durable and cheap, and the app can hand users a short-lived signed link to download theirs, without a server in between." }),
  ],
};

export const scenes = [threeTierScene, serverlessScene];

export const subjects: Subject[] = [
  { id: threeTierScene.id, title: threeTierScene.title, supported: true, scene: threeTierScene },
  { id: serverlessScene.id, title: serverlessScene.title, supported: true, scene: serverlessScene },
  { id: "kubernetes", title: "Kubernetes cluster", supported: false, note: "Planned. Needs a curated scene for pods, nodes and the control plane." },
  { id: "neural-network", title: "Neural network layers", supported: false, note: "Planned. Needs a curated scene for layers, weights and activations." },
];

export const stepsOf = (s: Scene) => [...s.components].sort((a, b) => a.step - b.step);
export const sceneForMarker = (id: number) => scenes.find((s) => s.markerId === id);
