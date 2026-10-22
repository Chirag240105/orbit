export type SceneComponent = {
  id: string; label: string; shape: "box" | "cylinder" | "sphere"; position: [number, number, number];
  size: [number, number, number]; color: string; zone: "internet" | "vpc"; summary: string; details: string; step: number; connectsTo: string[];
  /** Structured learning content shown when the component is selected. */
  apis?: string; dataModel?: string; failureMode?: string; tradeOffs?: string; scaling?: string;
};
export type SystemDesignOverview = {
  requirements: string[];
  assumptions: string[];
  architecture: string;
  requestFlow: string[];
};
export type Scene = { id: string; title: string; description: string; components: SceneComponent[]; overview?: SystemDesignOverview };
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

/** Amazon-like e-commerce interview architecture (proposed, not Amazon's internal implementation). */
export const ecommerceScene: Scene = {
  id: "ecommerce-amazon",
  title: "Amazon-like e-commerce system",
  description: "A proposed interview architecture for an Amazon-like e-commerce platform. Labeled as a learning exercise, not Amazon's private internal design.",
  components: [
    c({ id: "customer", label: "Customer", shape: "sphere", position: [0, 0.5, 4], size: [0.7, 0.7, 0.7], color: "#6c9eff", zone: "internet", step: 1, connectsTo: ["cdn"],
      summary: "A shopper browses products, adds to cart, and checks out.",
      details: "The customer interacts through a web or mobile app. Requests go over HTTPS to the nearest edge. Peak traffic (flash sales, holidays) can spike 10-100x.",
      apis: "No direct API — uses the CDN and API Gateway.",
      scaling: "Traffic is read-heavy (browsing >> buying). Edge caching and CDN absorb most reads.",
    }),
    c({ id: "cdn", label: "CDN / Edge", shape: "box", position: [3, 0.5, 3], size: [1.6, 0.7, 1], color: "#5fc59a", zone: "internet", step: 2, connectsTo: ["api-gateway"],
      summary: "Serves static assets and caches product pages at the edge.",
      details: "A CDN (like CloudFront) delivers images, CSS, JS, and cached HTML from edge locations close to the user. This reduces latency and offloads traffic from origin servers.",
      apis: "Serves cached GET responses; invalidates on catalog updates.",
      failureMode: "Cache stampede if many users request the same uncached key simultaneously. Mitigate with request coalescing and stale-while-revalidate.",
      scaling: "Horizontal — more edge POPs. Nearly unlimited for static content.",
    }),
    c({ id: "api-gateway", label: "API Gateway", shape: "box", position: [0, 0.5, 1], size: [2.4, 0.8, 1], color: "#e3b25c", zone: "vpc", step: 3, connectsTo: ["catalog", "cart", "order"],
      summary: "Single entry point: routing, auth, rate limiting, and load balancing.",
      details: "The API Gateway authenticates each request (JWT or session token), enforces rate limits, routes to the right microservice, and returns a unified response. It shields internal services from direct exposure.",
      apis: "REST: GET /products, POST /cart, POST /orders, GET /orders/{id}. GraphQL is common for flexible product queries.",
      failureMode: "Becomes a single point of failure. Mitigate with multiple gateway instances behind a load balancer.",
      scaling: "Stateless — scale horizontally. Rate limiting protects downstream services.",
    }),
    c({ id: "catalog", label: "Product Catalog", shape: "box", position: [-3.5, 0.5, -0.5], size: [1.6, 0.8, 1], color: "#c792ea", zone: "vpc", step: 4, connectsTo: ["db", "cache"],
      summary: "Stores and serves product information, categories, and pricing.",
      details: "The catalog service manages product metadata (title, description, images, price, category). Reads dominate (browsing), writes are infrequent (merchants update products). Search is often delegated to a dedicated search index.",
      apis: "GET /products/{id}, GET /products?category=…, GET /search?q=…",
      dataModel: "Products: id, title, description, price, category_id, image_urls. Categories: id, name, parent_id.",
      failureMode: "Stale pricing after a merchant update if cache TTL is too long. Mitigate with cache invalidation on write.",
      scaling: "Read replicas for the database. Redis cache for hot products. Eventually, CQRS with a search index (Elasticsearch).",
    }),
    c({ id: "cart", label: "Cart Service", shape: "box", position: [0, 0.5, -0.5], size: [1.5, 0.8, 1], color: "#4fb3c9", zone: "vpc", step: 5, connectsTo: ["cache", "order"],
      summary: "Manages the user's shopping cart across sessions and devices.",
      details: "The cart stores items a user intends to buy. Carts are temporary and frequently updated (add, remove, change quantity). Redis is a common backing store because cart data is short-lived and fast-changing.",
      apis: "GET /cart, POST /cart/items, PATCH /cart/items/{id}, DELETE /cart/items/{id}",
      dataModel: "Cart: user_id, items[{product_id, qty}]. Stored in Redis as a hash or JSON.",
      failureMode: "Cart loss on Redis failover if not persisted. Mitigate with Redis persistence (AOF) or a DB fallback.",
      scaling: "Redis is in-memory and scales well for high-throughput, short-lived data. Shard by user ID at extreme scale.",
    }),
    c({ id: "order", label: "Order Service", shape: "box", position: [3.5, 0.5, -0.5], size: [1.6, 0.8, 1], color: "#ed8a72", zone: "vpc", step: 6, connectsTo: ["payment", "inventory", "queue"],
      summary: "Creates and tracks orders through their lifecycle.",
      details: "The order service orchestrates checkout: validate cart, reserve inventory, charge payment, create order record. It coordinates with payment and inventory services, often asynchronously via a message queue for reliability.",
      apis: "POST /orders (checkout), GET /orders/{id}, PATCH /orders/{id}/status",
      dataModel: "Orders: id, user_id, items[{product_id, qty, price}], status (pending, paid, fulfilled, cancelled), total, created_at.",
      failureMode: "Inconsistent state if payment succeeds but inventory reservation fails. Mitigate with the Saga pattern and compensating transactions.",
      scaling: "Partition by order ID or user ID. Use a message queue to decouple from payment and inventory.",
    }),
    c({ id: "payment", label: "Payment", shape: "sphere", position: [5, 0.5, -3], size: [0.8, 0.8, 0.8], color: "#f0706a", zone: "internet", step: 7, connectsTo: [],
      summary: "Processes payment through external payment gateways.",
      details: "The payment service communicates with external payment processors (Stripe, PayPal, bank networks). It handles idempotency (don't charge twice), retries, and webhook callbacks for payment status updates.",
      apis: "POST /payments, GET /payments/{id}, POST /payments/{id}/refund",
      failureMode: "Gateway timeout or double-charge on retry. Mitigate with idempotency keys and at-least-once delivery with deduplication.",
      tradeOffs: "Synchronous payment gives immediate confirmation but couples checkout to external latency. Async with webhooks decouples but adds complexity.",
      scaling: "Rate-limited by the payment processor. Queue payments during spikes and process asynchronously.",
    }),
    c({ id: "inventory", label: "Inventory", shape: "box", position: [-3.5, 0.5, -3], size: [1.5, 0.8, 1], color: "#a68cf0", zone: "vpc", step: 8, connectsTo: ["db"],
      summary: "Tracks stock levels and reserves items during checkout.",
      details: "Inventory tracks available stock per product/SKU. During checkout, it reserves stock (decrement available, increment reserved). On fulfillment, it commits (decrement reserved). On cancellation, it releases (increment available, decrement reserved).",
      apis: "GET /inventory/{sku}, POST /inventory/{sku}/reserve, POST /inventory/{sku}/release, POST /inventory/{sku}/commit",
      dataModel: "Inventory: sku, available, reserved, total. Updates are row-level and need atomic operations.",
      failureMode: "Overselling if concurrent reservations race. Mitigate with database row locks, optimistic locking, or Redis atomic decrements.",
      scaling: "Shard by SKU. Use a write-through cache for hot SKUs. Batch updates for non-hot items.",
    }),
    c({ id: "db", label: "Database", shape: "cylinder", position: [-2, 0.6, -5.5], size: [1, 1.2, 1], color: "#c792ea", zone: "vpc", step: 9, connectsTo: [],
      summary: "Primary durable storage for products, orders, and users.",
      details: "Each microservice typically owns its database (database-per-service). Product catalog uses a read-optimized store (PostgreSQL with replicas). Orders use a transactional database. This avoids a single shared database bottleneck.",
      dataModel: "Separate schemas per service: products, orders, users, inventory. No shared tables.",
      failureMode: "Primary failure. Mitigate with synchronous replication + automatic failover. Split-brain risk mitigated with quorum-based consensus.",
      tradeOffs: "Shared DB is simpler but creates coupling. Database-per-service is more complex but allows independent scaling and failure isolation.",
      scaling: "Read replicas for reads. Sharding by user ID or order ID for writes at extreme scale.",
    }),
    c({ id: "cache", label: "Cache (Redis)", shape: "cylinder", position: [1, 0.6, -5.5], size: [0.9, 1, 0.9], color: "#4fb3c9", zone: "vpc", step: 10, connectsTo: [],
      summary: "In-memory cache for hot product data, sessions, and carts.",
      details: "Redis serves as a multi-purpose cache: product catalog cache, cart store, session store, and rate-limit counter. Cache hits avoid database reads, dramatically reducing latency for browse-heavy traffic.",
      failureMode: "Cache miss storm on restart or cold start. Mitigate with cache warming and staggered TTLs.",
      scaling: "Redis Cluster for horizontal scaling. Shard by key hash. Eviction policies (LRU) for memory management.",
    }),
    c({ id: "queue", label: "Message Queue", shape: "box", position: [4, 0.5, -5.5], size: [1.4, 0.8, 1], color: "#e3b25c", zone: "vpc", step: 11, connectsTo: [],
      summary: "Decouples order processing from payment and inventory updates.",
      details: "A message queue (Kafka, SQS, RabbitMQ) enables asynchronous processing: the order service publishes events (OrderCreated, PaymentConfirmed) and downstream services consume them. This decouples services, enables retries, and absorbs traffic spikes.",
      apis: "Publish: OrderCreated, PaymentRequested. Consume: at-least-once with deduplication.",
      failureMode: "Message loss if the queue crashes before persistence. Mitigate with durable queues and acknowledgment after processing.",
      tradeOffs: "Async adds latency (user waits for confirmation) but improves resilience. Use sync for payment, async for fulfillment.",
      scaling: "Partition topics by key (e.g., order ID) for parallel consumption. Consumer groups scale horizontally.",
    }),
  ],
  overview: {
    requirements: [
      "Functional: browse products, search, add to cart, checkout, pay, track order, manage inventory.",
      "Non-functional: low latency for browsing (<200ms), high availability (99.99%), handle 10x traffic spikes during sales.",
      "Read-heavy: browsing traffic is 100x larger than checkout traffic.",
      "Consistency: inventory must not oversell; payment must not double-charge; order status must be eventually consistent.",
    ],
    assumptions: [
      "100M products, 200M users, 10K orders/day average, 1M orders/day during peak sales.",
      "Product images are static and cacheable; product metadata changes infrequently.",
      "Payment is processed by an external gateway; fulfillment is asynchronous.",
    ],
    architecture: "Microservices with an API Gateway. Each service owns its data. CDN for static content, Redis for caching and carts, a message queue for async order processing, and database-per-service for isolation.",
    requestFlow: [
      "Customer requests a product page — CDN serves cached HTML and images.",
      "API Gateway authenticates the request and routes to the Product Catalog service.",
      "Catalog serves from Redis cache (hot products) or falls back to the read replica database.",
      "Customer adds to cart — Cart service stores the item in Redis.",
      "Customer checks out — Order service reserves inventory, charges payment, and creates the order.",
      "Payment is processed synchronously (user waits). Fulfillment is queued asynchronously.",
      "Inventory reservation is committed when fulfillment starts, or released if the order is cancelled.",
    ],
  },
};

export const subjects: Subject[] = [
  { id: threeTierScene.id, title: threeTierScene.title, supported: true, scene: threeTierScene },
  { id: ecommerceScene.id, title: ecommerceScene.title, supported: true, scene: ecommerceScene },
  { id: "kubernetes", title: "Kubernetes cluster", supported: false, note: "Planned. Needs a curated scene for pods, nodes and the control plane." },
  { id: "neural-network", title: "Neural network layers", supported: false, note: "Planned. Needs a curated scene for layers, weights and activations." },
];

const bankingParts: Omit<SceneComponent, "position" | "step">[] = [
  { id: "customer", label: "Customer", shape: "sphere", size: [0.75, 0.75, 0.75], color: "#6c9eff", zone: "internet", connectsTo: ["banking-api"], summary: "A person uses a banking app or visits a branch.", details: "The customer starts an action such as checking a balance or sending money. The app should show a clear result without exposing private account data." },
  { id: "banking-api", label: "Banking API", shape: "box", size: [1.6, 0.8, 1], color: "#5fc59a", zone: "vpc", connectsTo: ["identity", "account"], summary: "Receives and validates each banking request.", details: "The API checks the request format, the signed-in identity, and whether that customer may access the requested account. It coordinates services without trusting the browser." },
  { id: "identity", label: "Identity & fraud", shape: "box", size: [1.5, 0.8, 1], color: "#e3b25c", zone: "vpc", connectsTo: ["ledger"], summary: "Checks authentication, permissions, and suspicious activity.", details: "Multi-factor authentication helps confirm who is acting. Risk checks can pause unusual transfers for review. Authorization must be checked for every account operation." },
  { id: "account", label: "Account service", shape: "box", size: [1.5, 0.8, 1], color: "#4fb3c9", zone: "vpc", connectsTo: ["ledger", "account-db"], summary: "Provides account details and current balances.", details: "This service reads customer and account information. It applies account status and ownership rules before returning data to the API." },
  { id: "ledger", label: "Double-entry ledger", shape: "cylinder", size: [1, 1.1, 1], color: "#c792ea", zone: "vpc", connectsTo: ["account-db", "payments"], summary: "Records every money movement as balanced entries.", details: "A transfer debits one account and credits another. Recording both sides together preserves the accounting invariant: total debits equal total credits. Ledger entries are append-only for traceability." },
  { id: "account-db", label: "Bank database", shape: "cylinder", size: [0.9, 1, 0.9], color: "#a68cf0", zone: "vpc", connectsTo: [], summary: "Stores accounts, balances, and transaction records.", details: "Durable storage is protected with access controls, encryption, backups, and recovery procedures. A production bank also replicates data and monitors integrity." },
  { id: "payments", label: "Payment network", shape: "sphere", size: [0.75, 0.75, 0.75], color: "#ed8a72", zone: "internet", connectsTo: [], summary: "Connects the bank to other banks and payment rails.", details: "External transfers are sent through payment networks. The bank tracks each transfer through pending, settled, or failed states and reconciles external confirmations." },
];

/** Create a safe, local starter diagram for a learner's topic. */
export function createTopicScene(topicInput: string): Scene {
  const topic = topicInput.trim().replace(/\s+/g, " ").slice(0, 80);
  const isBanking = /bank|banking|finance|payment|ledger|money|transfer/i.test(topic);
  const title = topic.toLowerCase().includes("system") ? topic : `${topic} system`;
  const components: SceneComponent[] = isBanking
    ? bankingParts.map((part, index) => ({
        ...part,
        position: [-6 + index * 2, index % 2 === 0 ? 0.5 : 1, index % 2 === 0 ? 1 : -1],
        step: index + 1,
      }))
    : ["User", "Interface", "Core service", "Data store", "Security", "Result"].map((label, index, all) => {
        const id = `topic-${index}`;
        const nextId = index < all.length - 1 ? [`topic-${index + 1}`] : [];
        const names = [`A person starts learning about ${topic}.`, `The interface accepts a request about ${topic}.`, `The main ${topic} logic processes the request.`, `Relevant ${topic} information is stored and retrieved.`, `Access and data are checked for safety.`, `The system returns a useful result to the user.`];
        return {
          id, label: index === 2 ? `${topic} service`.slice(0, 48) : label, shape: index === 3 ? "cylinder" as const : index === 0 || index === 5 ? "sphere" as const : "box" as const,
          position: [-5 + index * 2, index % 2 ? 1 : 0.5, index % 2 ? -1 : 1], size: index === 0 || index === 5 ? [0.7, 0.7, 0.7] : [1.4, 0.8, 1],
          color: ["#6c9eff", "#5fc59a", "#e3b25c", "#c792ea", "#ed8a72", "#4fb3c9"][index], zone: index === 0 || index === 5 ? "internet" as const : "vpc" as const,
          summary: names[index], details: `${names[index]} This is a starter learning map; select parts and ask Orbit to expand them with examples.`, step: index + 1, connectsTo: nextId,
        };
      });
  return {
    id: `topic-${Date.now()}`, title,
    description: isBanking ? "A learning map of a typical digital banking flow, from customer request through security and ledger recording to payment networks." : `A starter learning map for ${topic}, arranged as a flow from user input through processing and data to a result.`,
    components,
  };
}

export const stepsOf = (s: Scene) => [...s.components].sort((a, b) => a.step - b.step);
