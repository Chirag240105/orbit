export const componentKinds = [
  "user", "client", "edge", "gateway", "service", "agent", "ai", "database", "cache", "queue",
  "payment", "cart", "warehouse", "security", "ledger", "memory", "network", "output",
  "gpu", "vector", "monitor", "mobile",
] as const;
/** Visual archetype that picks the 3D model drawn for a component. */
export type ComponentKind = typeof componentKinds[number];

export const kindLabels: Record<ComponentKind, string> = {
  user: "Person", client: "Client app", edge: "Edge network", gateway: "Gateway", service: "Service", agent: "AI agent",
  ai: "AI model", database: "Database", cache: "Cache", queue: "Message queue", payment: "Payments", cart: "Cart",
  warehouse: "Inventory", security: "Security", ledger: "Ledger", memory: "Memory", network: "Network", output: "Result",
  gpu: "GPU node", vector: "Vector database", monitor: "Observability", mobile: "Mobile app",
};

export type SceneComponent = {
  id: string; label: string; shape: "box" | "cylinder" | "sphere";
  /** Optional model archetype; falls back to one derived from `shape`. */
  kind?: ComponentKind; position: [number, number, number];
  size: [number, number, number]; color: string;
  /** Network zone. `gpu` parts sit inside the private network, in their own GPU cluster. */
  zone: "internet" | "vpc" | "gpu"; summary: string; details: string; step: number; connectsTo: string[];
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
export type Subject = { id: string; title: string; shortTitle?: string; supported: boolean; scene?: Scene; note?: string };

const c = (x: SceneComponent) => x;

export const threeTierScene: Scene = {
  id: "three-tier-web-app",
  title: "Three-tier web app on the cloud",
  description: "A curated, hand-built scene. Traffic flows from users at the front, through the edge and load balancer, to app servers, then to data stores.",
  components: [
    c({ kind: "client", id: "frontend", label: "Frontend", shape: "box", position: [0, 0.5, 4], size: [2, 0.8, 1], color: "#6c9eff", zone: "internet", step: 1, connectsTo: ["api"], summary: "The browser interface a person interacts with.", details: "The frontend renders screens, collects input, and calls the backend over HTTPS. It should not contain provider keys or make privileged database writes directly." }),
    c({ kind: "gateway", id: "api", label: "API", shape: "box", position: [0, 0.5, 1.8], size: [2, 0.8, 1], color: "#5fc59a", zone: "vpc", step: 2, connectsTo: ["agent"], summary: "Authenticates requests and enforces access rules.", details: "The API validates input, checks the signed-in user, applies rate limits, and records sensitive actions. It forms the controlled boundary between the browser and application services." }),
    c({ kind: "agent", id: "agent", label: "Agent", shape: "box", position: [0, 0.5, -0.5], size: [2, 0.9, 1.2], color: "#e3b25c", zone: "vpc", step: 3, connectsTo: ["memory", "nebius"], summary: "Plans work and chooses permission-checked tools.", details: "The agent uses approved context to answer or prepare actions. Reads are audited; writes wait for explicit confirmation, so the model cannot directly change files or records." }),
    c({ kind: "memory", id: "memory", label: "Memory", shape: "cylinder", position: [-2.3, 0.6, -3], size: [1, 1.2, 1], color: "#c792ea", zone: "vpc", step: 4, connectsTo: [], summary: "Stores user-approved facts and project context.", details: "Memory is user scoped and can be confirmed, edited, or deleted. Retrieval adds only relevant approved records to a request." }),
    c({ kind: "ai", id: "nebius", label: "Nebius", shape: "sphere", position: [2.3, 0.7, -3], size: [0.85, 0.85, 0.85], color: "#4fb3c9", zone: "internet", step: 5, connectsTo: [], summary: "Hosted model provider for language tasks.", details: "Only the prompt and context needed for a request leave the app, after redaction and consent where workspace files are involved. Provider keys stay on the backend." }),
  ],
};

/** Amazon-like e-commerce interview architecture (proposed, not Amazon's internal implementation). */
export const ecommerceScene: Scene = {
  id: "ecommerce-amazon",
  title: "Amazon-like e-commerce system",
  description: "A proposed interview architecture for an Amazon-like e-commerce platform. Labeled as a learning exercise, not Amazon's private internal design.",
  components: [
    c({ kind: "user", id: "customer", label: "Customer", shape: "sphere", position: [0, 0.5, 4], size: [0.7, 0.7, 0.7], color: "#6c9eff", zone: "internet", step: 1, connectsTo: ["cdn"],
      summary: "A shopper browses products, adds to cart, and checks out.",
      details: "The customer interacts through a web or mobile app. Requests go over HTTPS to the nearest edge. Peak traffic (flash sales, holidays) can spike 10-100x.",
      apis: "No direct API — uses the CDN and API Gateway.",
      scaling: "Traffic is read-heavy (browsing >> buying). Edge caching and CDN absorb most reads.",
    }),
    c({ kind: "edge", id: "cdn", label: "CDN / Edge", shape: "box", position: [3, 0.5, 3], size: [1.6, 0.7, 1], color: "#5fc59a", zone: "internet", step: 2, connectsTo: ["api-gateway"],
      summary: "Serves static assets and caches product pages at the edge.",
      details: "A CDN (like CloudFront) delivers images, CSS, JS, and cached HTML from edge locations close to the user. This reduces latency and offloads traffic from origin servers.",
      apis: "Serves cached GET responses; invalidates on catalog updates.",
      failureMode: "Cache stampede if many users request the same uncached key simultaneously. Mitigate with request coalescing and stale-while-revalidate.",
      scaling: "Horizontal — more edge POPs. Nearly unlimited for static content.",
    }),
    c({ kind: "gateway", id: "api-gateway", label: "API Gateway", shape: "box", position: [0, 0.5, 1], size: [2.4, 0.8, 1], color: "#e3b25c", zone: "vpc", step: 3, connectsTo: ["catalog", "cart", "order"],
      summary: "Single entry point: routing, auth, rate limiting, and load balancing.",
      details: "The API Gateway authenticates each request (JWT or session token), enforces rate limits, routes to the right microservice, and returns a unified response. It shields internal services from direct exposure.",
      apis: "REST: GET /products, POST /cart, POST /orders, GET /orders/{id}. GraphQL is common for flexible product queries.",
      failureMode: "Becomes a single point of failure. Mitigate with multiple gateway instances behind a load balancer.",
      scaling: "Stateless — scale horizontally. Rate limiting protects downstream services.",
    }),
    c({ kind: "service", id: "catalog", label: "Product Catalog", shape: "box", position: [-3.5, 0.5, -0.5], size: [1.6, 0.8, 1], color: "#c792ea", zone: "vpc", step: 4, connectsTo: ["db", "cache"],
      summary: "Stores and serves product information, categories, and pricing.",
      details: "The catalog service manages product metadata (title, description, images, price, category). Reads dominate (browsing), writes are infrequent (merchants update products). Search is often delegated to a dedicated search index.",
      apis: "GET /products/{id}, GET /products?category=…, GET /search?q=…",
      dataModel: "Products: id, title, description, price, category_id, image_urls. Categories: id, name, parent_id.",
      failureMode: "Stale pricing after a merchant update if cache TTL is too long. Mitigate with cache invalidation on write.",
      scaling: "Read replicas for the database. Redis cache for hot products. Eventually, CQRS with a search index (Elasticsearch).",
    }),
    c({ kind: "cart", id: "cart", label: "Cart Service", shape: "box", position: [0, 0.5, -0.5], size: [1.5, 0.8, 1], color: "#4fb3c9", zone: "vpc", step: 5, connectsTo: ["cache", "order"],
      summary: "Manages the user's shopping cart across sessions and devices.",
      details: "The cart stores items a user intends to buy. Carts are temporary and frequently updated (add, remove, change quantity). Redis is a common backing store because cart data is short-lived and fast-changing.",
      apis: "GET /cart, POST /cart/items, PATCH /cart/items/{id}, DELETE /cart/items/{id}",
      dataModel: "Cart: user_id, items[{product_id, qty}]. Stored in Redis as a hash or JSON.",
      failureMode: "Cart loss on Redis failover if not persisted. Mitigate with Redis persistence (AOF) or a DB fallback.",
      scaling: "Redis is in-memory and scales well for high-throughput, short-lived data. Shard by user ID at extreme scale.",
    }),
    c({ kind: "service", id: "order", label: "Order Service", shape: "box", position: [3.5, 0.5, -0.5], size: [1.6, 0.8, 1], color: "#ed8a72", zone: "vpc", step: 6, connectsTo: ["payment", "inventory", "queue"],
      summary: "Creates and tracks orders through their lifecycle.",
      details: "The order service orchestrates checkout: validate cart, reserve inventory, charge payment, create order record. It coordinates with payment and inventory services, often asynchronously via a message queue for reliability.",
      apis: "POST /orders (checkout), GET /orders/{id}, PATCH /orders/{id}/status",
      dataModel: "Orders: id, user_id, items[{product_id, qty, price}], status (pending, paid, fulfilled, cancelled), total, created_at.",
      failureMode: "Inconsistent state if payment succeeds but inventory reservation fails. Mitigate with the Saga pattern and compensating transactions.",
      scaling: "Partition by order ID or user ID. Use a message queue to decouple from payment and inventory.",
    }),
    c({ kind: "payment", id: "payment", label: "Payment", shape: "sphere", position: [5, 0.5, -3], size: [0.8, 0.8, 0.8], color: "#f0706a", zone: "internet", step: 7, connectsTo: [],
      summary: "Processes payment through external payment gateways.",
      details: "The payment service communicates with external payment processors (Stripe, PayPal, bank networks). It handles idempotency (don't charge twice), retries, and webhook callbacks for payment status updates.",
      apis: "POST /payments, GET /payments/{id}, POST /payments/{id}/refund",
      failureMode: "Gateway timeout or double-charge on retry. Mitigate with idempotency keys and at-least-once delivery with deduplication.",
      tradeOffs: "Synchronous payment gives immediate confirmation but couples checkout to external latency. Async with webhooks decouples but adds complexity.",
      scaling: "Rate-limited by the payment processor. Queue payments during spikes and process asynchronously.",
    }),
    c({ kind: "warehouse", id: "inventory", label: "Inventory", shape: "box", position: [-3.5, 0.5, -3], size: [1.5, 0.8, 1], color: "#a68cf0", zone: "vpc", step: 8, connectsTo: ["db"],
      summary: "Tracks stock levels and reserves items during checkout.",
      details: "Inventory tracks available stock per product/SKU. During checkout, it reserves stock (decrement available, increment reserved). On fulfillment, it commits (decrement reserved). On cancellation, it releases (increment available, decrement reserved).",
      apis: "GET /inventory/{sku}, POST /inventory/{sku}/reserve, POST /inventory/{sku}/release, POST /inventory/{sku}/commit",
      dataModel: "Inventory: sku, available, reserved, total. Updates are row-level and need atomic operations.",
      failureMode: "Overselling if concurrent reservations race. Mitigate with database row locks, optimistic locking, or Redis atomic decrements.",
      scaling: "Shard by SKU. Use a write-through cache for hot SKUs. Batch updates for non-hot items.",
    }),
    c({ kind: "database", id: "db", label: "Database", shape: "cylinder", position: [-2, 0.6, -5.5], size: [1, 1.2, 1], color: "#c792ea", zone: "vpc", step: 9, connectsTo: [],
      summary: "Primary durable storage for products, orders, and users.",
      details: "Each microservice typically owns its database (database-per-service). Product catalog uses a read-optimized store (PostgreSQL with replicas). Orders use a transactional database. This avoids a single shared database bottleneck.",
      dataModel: "Separate schemas per service: products, orders, users, inventory. No shared tables.",
      failureMode: "Primary failure. Mitigate with synchronous replication + automatic failover. Split-brain risk mitigated with quorum-based consensus.",
      tradeOffs: "Shared DB is simpler but creates coupling. Database-per-service is more complex but allows independent scaling and failure isolation.",
      scaling: "Read replicas for reads. Sharding by user ID or order ID for writes at extreme scale.",
    }),
    c({ kind: "cache", id: "cache", label: "Cache (Redis)", shape: "cylinder", position: [1, 0.6, -5.5], size: [0.9, 1, 0.9], color: "#4fb3c9", zone: "vpc", step: 10, connectsTo: [],
      summary: "In-memory cache for hot product data, sessions, and carts.",
      details: "Redis serves as a multi-purpose cache: product catalog cache, cart store, session store, and rate-limit counter. Cache hits avoid database reads, dramatically reducing latency for browse-heavy traffic.",
      failureMode: "Cache miss storm on restart or cold start. Mitigate with cache warming and staggered TTLs.",
      scaling: "Redis Cluster for horizontal scaling. Shard by key hash. Eviction policies (LRU) for memory management.",
    }),
    c({ kind: "queue", id: "queue", label: "Message Queue", shape: "box", position: [4, 0.5, -5.5], size: [1.4, 0.8, 1], color: "#e3b25c", zone: "vpc", step: 11, connectsTo: [],
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

/** A ChatGPT-style LLM platform with retrieval (RAG) and a GPU inference cluster. A proposed design for learning, not any vendor's internal architecture. */
export const llmPlatformScene: Scene = {
  id: "llm-platform",
  title: "LLM platform with retrieval (ChatGPT-style)",
  description: "A proposed architecture for a ChatGPT-style assistant: a chat request passes the edge, security and rate limits, gets context from retrieval, and is generated token by token on a GPU cluster. Documents are ingested into the vector index on a separate path.",
  components: [
    c({ kind: "user", id: "user", label: "Chat user", shape: "sphere", position: [-5, 0.5, 6.5], size: [0.7, 0.7, 0.7], color: "#6c9eff", zone: "internet", step: 1, connectsTo: ["web-client"],
      summary: "A person types a prompt and reads the answer as it streams in.",
      details: "Users judge an assistant mostly by how fast the first words appear (time to first token) and how smoothly the rest streams. Traffic is spiky: a product launch or a viral prompt can multiply load within minutes.",
      scaling: "Millions of concurrent sessions. Most of the cost is not the request itself but the GPU time to generate each answer." }),
    c({ kind: "client", id: "web-client", label: "Chat app", shape: "box", position: [-2.5, 0.5, 6.5], size: [1.4, 0.8, 1], color: "#5fc59a", zone: "internet", step: 2, connectsTo: ["cdn"],
      summary: "Web or mobile app that sends prompts and renders streamed tokens.",
      details: "The app keeps the conversation view, sends the prompt over HTTPS, and keeps a streaming connection open (Server-Sent Events or WebSocket) so tokens render as they are generated. It never holds model keys.",
      apis: "POST /v1/chat {conversation_id, message, stream: true} → text/event-stream of token deltas. POST /v1/documents (multipart upload).",
      failureMode: "Dropped streams on flaky mobile networks. Mitigate with resumable streams keyed by message ID, so the client can reconnect and continue." }),
    c({ kind: "edge", id: "cdn", label: "CDN / Edge", shape: "sphere", position: [0, 0.5, 6.5], size: [0.8, 0.8, 0.8], color: "#4fb3c9", zone: "internet", step: 3, connectsTo: ["api-gateway"],
      summary: "Terminates TLS near the user, serves app assets, and absorbs attacks.",
      details: "Static assets come from edge caches. API calls are not cacheable (every prompt is unique), so the edge mainly provides fast TLS termination, DDoS protection, and bot filtering before forwarding to the nearest region.",
      scaling: "Anycast routing sends users to the closest healthy region." }),
    c({ kind: "gateway", id: "api-gateway", label: "API gateway", shape: "box", position: [0, 0.5, 4], size: [1.6, 0.8, 1], color: "#e3b25c", zone: "vpc", step: 4, connectsTo: ["auth", "ingest-queue"],
      summary: "Single entry point: validation, routing, and the streaming proxy.",
      details: "The gateway validates request size and schema, routes chat calls to orchestration and uploads to ingestion, and holds long-lived streaming connections open while tokens flow back. It must support connections lasting tens of seconds.",
      failureMode: "Connection exhaustion: every streaming answer pins a connection for its whole duration. Mitigate with event-loop proxies and per-instance connection limits.",
      scaling: "Stateless and horizontally scaled; scale on open connections, not requests per second." }),
    c({ kind: "security", id: "auth", label: "Auth & API keys", shape: "box", position: [2.5, 0.5, 4], size: [1.4, 0.8, 1], color: "#f0706a", zone: "vpc", step: 5, connectsTo: ["rate-limiter"],
      summary: "Verifies who is calling and which plan and tenant they belong to.",
      details: "Checks a session token or API key, resolves the tenant, plan, and allowed models, and attaches that identity to the request. Every later decision (limits, data access, billing) uses this identity.",
      dataModel: "api_keys: hashed_key, tenant_id, scopes, created_at, revoked_at. Keys are stored hashed, never in plain text." }),
    c({ kind: "cache", id: "rate-limiter", label: "Rate limiter", shape: "cylinder", position: [5, 0.5, 4], size: [0.9, 1, 0.9], color: "#ed8a72", zone: "vpc", step: 6, connectsTo: ["orchestrator"],
      summary: "Limits requests and tokens per user and tenant.",
      details: "LLM limits count tokens, not just requests, because one long prompt can cost as much as a hundred short ones. A token bucket in Redis tracks requests per minute and tokens per minute for each tenant.",
      failureMode: "If Redis is unreachable, choose deliberately: fail open (risk overload) or fail closed (block users). Most platforms fail open with a local in-memory fallback limit.",
      tradeOffs: "Strict global limits need a shared store and add latency; per-instance limits are fast but allow bursts above quota." }),
    c({ kind: "agent", id: "orchestrator", label: "Orchestrator", shape: "box", position: [0, 0.5, 1.5], size: [1.4, 0.9, 1.2], color: "#e3b25c", zone: "vpc", step: 7, connectsTo: ["safety", "prompt-cache", "embedder", "router", "metering"],
      summary: "Builds the final prompt and coordinates every step of an answer.",
      details: "It loads conversation history, checks the prompt cache, retrieves relevant document chunks, assembles the system prompt plus context within the model's context window, and sends the request to inference. It may also run tool calls and loop until the answer is complete.",
      apis: "Internal: generate(prompt, model, max_tokens, stream) → token stream. retrieve(query, tenant_id, k) → chunks.",
      failureMode: "Context overflow: history plus retrieved chunks exceed the context window. Mitigate by summarizing old turns and capping retrieved tokens.",
      tradeOffs: "More retrieved context improves grounding but raises cost and time to first token, because every input token must be processed (prefill)." }),
    c({ kind: "security", id: "safety", label: "Safety filter", shape: "box", position: [2.5, 0.5, -1], size: [1.4, 0.8, 1], color: "#f0706a", zone: "vpc", step: 8, connectsTo: [],
      summary: "Screens prompts and answers for abuse, leaks, and prompt injection.",
      details: "A fast classifier checks input before generation and output while it streams. It flags disallowed content, redacts personal data, and detects instructions hidden inside retrieved documents (indirect prompt injection).",
      tradeOffs: "Checking output token by token adds latency; checking in small windows keeps streaming smooth while still stopping a bad answer early." }),
    c({ kind: "cache", id: "prompt-cache", label: "Semantic cache", shape: "cylinder", position: [2.5, 0.5, 1.5], size: [0.9, 1, 0.9], color: "#4fb3c9", zone: "vpc", step: 9, connectsTo: [],
      summary: "Returns stored answers for repeated or near-identical prompts.",
      details: "Common prompts (FAQs, templates) are answered from cache instead of the GPU. An exact-match cache keys on a hash of the prompt; a semantic cache compares embeddings and reuses answers above a similarity threshold.",
      failureMode: "A semantic match can return an answer to a subtly different question. Use a high similarity threshold and never share cached answers across tenants.",
      scaling: "A cache hit costs milliseconds versus seconds of GPU time." }),
    c({ kind: "ai", id: "embedder", label: "Embedding model", shape: "sphere", position: [-2.5, 0.5, 1.5], size: [0.8, 0.8, 0.8], color: "#c792ea", zone: "vpc", step: 10, connectsTo: ["vector-db"],
      summary: "Turns text into vectors so meaning can be searched.",
      details: "A small embedding model converts the user's question, and every document chunk during ingestion, into a vector of a few hundred to a few thousand numbers. Texts with similar meaning end up close together.",
      failureMode: "Changing the embedding model invalidates every stored vector. Re-embed the corpus into a new index and switch over atomically.",
      scaling: "Cheap compared to generation; batch many chunks per GPU call during ingestion." }),
    c({ kind: "vector", id: "vector-db", label: "Vector database", shape: "cylinder", position: [-5, 0.5, 1.5], size: [1, 1, 1], color: "#a68cf0", zone: "vpc", step: 11, connectsTo: ["doc-store"],
      summary: "Finds the document chunks closest in meaning to the question.",
      details: "Approximate nearest-neighbour indexes such as HNSW or IVF search millions of vectors in milliseconds. Results are filtered by tenant and access rights before they can enter a prompt.",
      dataModel: "vectors: chunk_id, tenant_id, embedding[1024], doc_id, acl_tags. Search: top-k by cosine similarity with a metadata filter.",
      failureMode: "Leaking another tenant's documents if filters are applied after search. Always filter by tenant inside the query.",
      tradeOffs: "Higher recall settings find better chunks but search slower; a reranker on the top 50 often beats tuning the index." }),
    c({ kind: "database", id: "doc-store", label: "Document store", shape: "cylinder", position: [-7.5, 0.5, 1.5], size: [1, 1.2, 1], color: "#c792ea", zone: "vpc", step: 12, connectsTo: [],
      summary: "Keeps the original files, chunk text, and metadata.",
      details: "Files live in object storage; chunk text, titles, and permissions live in a relational database. The vector index stores only IDs and vectors, so answers can cite the exact source passage.",
      dataModel: "documents: id, tenant_id, title, uri, acl. chunks: id, doc_id, position, text, token_count." }),
    c({ kind: "network", id: "router", label: "Inference router", shape: "sphere", position: [0, 0.5, -1], size: [0.8, 0.8, 0.8], color: "#76b900", zone: "vpc", step: 13, connectsTo: ["gpu-a", "gpu-b", "gpu-c", "observability"],
      summary: "Schedules each generation onto the best GPU replica.",
      details: "The router sends each request to the replica with spare capacity, preferring one that already holds the same prompt prefix in its KV cache. Model servers use continuous batching, so many users' requests share each GPU step.",
      failureMode: "A slow or failed node keeps receiving traffic. Use health checks and queue-depth signals, and retry interrupted generations on another replica.",
      tradeOffs: "Bigger batches raise throughput (tokens per second per GPU) but increase each user's latency.",
      scaling: "Autoscale replicas on queue depth and GPU utilization; new GPU nodes take minutes to load weights, so scale ahead of demand." }),
    c({ kind: "gpu", id: "gpu-a", label: "GPU node A", shape: "box", position: [-2.5, 0.5, -3.5], size: [1.4, 0.6, 0.8], color: "#76b900", zone: "gpu", step: 14, connectsTo: ["kv-cache"],
      summary: "Runs the language model and generates tokens.",
      details: "A model server (for example vLLM, TensorRT-LLM, or NVIDIA NIM) holds the model weights in GPU memory. Generation has two phases: prefill processes the whole prompt at once, then decode produces one token at a time.",
      failureMode: "Out of GPU memory when too many long conversations run at once. Paged KV-cache memory and admission control prevent crashes.",
      scaling: "Large models are split across several GPUs with tensor parallelism; more replicas add throughput." }),
    c({ kind: "gpu", id: "gpu-b", label: "GPU node B", shape: "box", position: [0, 0.5, -3.5], size: [1.4, 0.6, 0.8], color: "#76b900", zone: "gpu", step: 15, connectsTo: ["kv-cache"],
      summary: "An identical replica that shares the load.",
      details: "Replicas run the same model version, so any of them can serve any request. Running several replicas lets the cluster absorb spikes and survive a node failure without dropping users.",
      scaling: "Throughput grows roughly linearly with replicas; latency per request does not improve by adding replicas." }),
    c({ kind: "gpu", id: "gpu-c", label: "GPU node C", shape: "box", position: [2.5, 0.5, -3.5], size: [1.4, 0.6, 0.8], color: "#76b900", zone: "gpu", step: 16, connectsTo: ["kv-cache"],
      summary: "A third replica, often kept for headroom or a canary model.",
      details: "One replica can run a new model version for a small share of traffic (a canary) while the others serve the stable version. If quality or latency drops, traffic shifts back.",
      tradeOffs: "Idle headroom wastes expensive GPUs, but without it a spike or failure means queueing and slow answers." }),
    c({ kind: "memory", id: "kv-cache", label: "KV / prefix cache", shape: "box", position: [0, 0.5, -6], size: [1, 0.4, 1], color: "#b4e36b", zone: "gpu", step: 17, connectsTo: [],
      summary: "Reuses attention state for prompts that share the same start.",
      details: "During prefill the model computes key and value tensors for every input token. Many requests share a long system prompt, so storing those tensors and reusing them skips most of the prefill work and cuts time to first token.",
      failureMode: "The cache fills GPU memory quickly. Evict least-recently-used prefixes and spill to CPU memory when needed.",
      scaling: "Prefix-aware routing sends similar prompts to the replica that already holds their cache." }),
    c({ kind: "payment", id: "metering", label: "Usage metering", shape: "box", position: [5, 0.5, -1], size: [1.2, 0.8, 1], color: "#e3b25c", zone: "vpc", step: 18, connectsTo: ["observability"],
      summary: "Counts prompt and output tokens for billing and quotas.",
      details: "Each finished generation emits an event with tenant, model, input tokens, and output tokens. Events are aggregated into usage records for invoices, dashboards, and quota enforcement.",
      dataModel: "usage_events: request_id, tenant_id, model, input_tokens, output_tokens, latency_ms, created_at.",
      failureMode: "Double counting on retries. Deduplicate events by request ID." }),
    c({ kind: "monitor", id: "observability", label: "Observability", shape: "box", position: [5, 0.5, 1.5], size: [1.2, 0.8, 1], color: "#6c9eff", zone: "vpc", step: 19, connectsTo: [],
      summary: "Tracks latency, token throughput, GPU use, and errors.",
      details: "Key signals are time to first token, tokens per second, queue depth, GPU utilization and memory, error rates, and safety-filter hits. Distributed traces follow one request across every component.",
      scaling: "Sample traces at high traffic; keep full metrics." }),
    c({ kind: "queue", id: "ingest-queue", label: "Ingestion queue", shape: "box", position: [-5, 0.5, 4], size: [1.4, 0.8, 1], color: "#e3b25c", zone: "vpc", step: 20, connectsTo: ["ingest-workers"],
      summary: "Turns document uploads into background jobs.",
      details: "Uploading a large PDF should not block a chat request, so each upload becomes a job on a durable queue. The user sees progress and can chat once indexing finishes.",
      failureMode: "Poison documents that crash parsers. Retry with backoff, then move them to a dead-letter queue for inspection." }),
    c({ kind: "service", id: "ingest-workers", label: "Ingestion workers", shape: "box", position: [-7.5, 0.5, 4], size: [1.4, 0.8, 1], color: "#5fc59a", zone: "vpc", step: 21, connectsTo: ["embedder", "doc-store"],
      summary: "Parse, clean, chunk, and embed uploaded documents.",
      details: "Workers extract text, split it into overlapping chunks of a few hundred tokens, store the chunks, and request embeddings for each one. Chunk size is a key quality setting for retrieval.",
      tradeOffs: "Small chunks retrieve precisely but lose surrounding context; large chunks keep context but dilute relevance and use more prompt tokens.",
      scaling: "Scale workers on queue length; embedding calls are batched for GPU efficiency." }),
    c({ kind: "warehouse", id: "model-registry", label: "Model registry", shape: "box", position: [-2.5, 0.5, -1], size: [1.4, 0.8, 1], color: "#a68cf0", zone: "vpc", step: 22, connectsTo: ["router"],
      summary: "Stores versioned model weights and rolls them out.",
      details: "Each model version (weights, tokenizer, configuration, evaluation results) is stored immutably. Deployments tell the router which version each replica runs, enabling canaries and instant rollback.",
      failureMode: "A bad model version reaching all replicas at once. Roll out gradually and watch quality and latency metrics before promoting." }),
  ],
  overview: {
    requirements: [
      "Functional: chat with streaming answers, conversation history, answers grounded in uploaded documents with citations, and per-tenant API keys.",
      "Non-functional: time to first token under 1 second, steady streaming, 99.9% availability, and strict tenant isolation for documents.",
      "Cost: GPU time dominates, so maximize tokens per second per GPU through batching and caching.",
      "Safety: screen inputs and outputs, and treat retrieved documents as untrusted input.",
    ],
    assumptions: [
      "10M daily users, 50M chat requests per day, peaks of about 3x average.",
      "Average prompt of 1,500 tokens (including retrieved context) and answers of 300 tokens.",
      "One model family served on a GPU cluster; documents total about 100M chunks across all tenants.",
    ],
    architecture: "A stateless edge and gateway layer in front of an orchestrator that assembles prompts using a semantic cache and retrieval-augmented generation (embedding model, vector index, document store). Generation runs on a GPU cluster of model-server replicas behind a KV-cache-aware router. Ingestion, metering, and observability run asynchronously so they never slow the chat path.",
    requestFlow: [
      "The user sends a prompt; the app opens a streaming connection through the CDN to the API gateway.",
      "Auth resolves the tenant and plan; the rate limiter checks request and token budgets.",
      "The orchestrator runs input safety checks and looks for a cached answer.",
      "On a cache miss it embeds the question, searches the vector database with a tenant filter, and loads the matching chunks.",
      "It assembles history plus retrieved context into one prompt and sends it to the inference router.",
      "The router picks a GPU replica, preferably one holding the prompt prefix in its KV cache; prefill runs, then tokens decode one by one.",
      "Tokens stream back through the gateway to the user while output safety checks run.",
      "When the answer finishes, usage is metered and latency and token metrics flow to observability.",
    ],
  },
};

export const subjects: Subject[] = [
  { id: llmPlatformScene.id, title: "LLM platform (ChatGPT-style)", shortTitle: "ChatGPT-style LLM", supported: true, scene: llmPlatformScene },
  { id: threeTierScene.id, title: threeTierScene.title, shortTitle: "Three-tier web app", supported: true, scene: threeTierScene },
  { id: ecommerceScene.id, title: ecommerceScene.title, shortTitle: "E-commerce", supported: true, scene: ecommerceScene },
];

const bankingParts: Omit<SceneComponent, "position" | "step">[] = [
  { kind: "user", id: "customer", label: "Customer", shape: "sphere", size: [0.75, 0.75, 0.75], color: "#6c9eff", zone: "internet", connectsTo: ["banking-api"], summary: "A person uses a banking app or visits a branch.", details: "The customer starts an action such as checking a balance or sending money. The app should show a clear result without exposing private account data." },
  { kind: "gateway", id: "banking-api", label: "Banking API", shape: "box", size: [1.6, 0.8, 1], color: "#5fc59a", zone: "vpc", connectsTo: ["identity", "account"], summary: "Receives and validates each banking request.", details: "The API checks the request format, the signed-in identity, and whether that customer may access the requested account. It coordinates services without trusting the browser." },
  { kind: "security", id: "identity", label: "Identity & fraud", shape: "box", size: [1.5, 0.8, 1], color: "#e3b25c", zone: "vpc", connectsTo: ["ledger"], summary: "Checks authentication, permissions, and suspicious activity.", details: "Multi-factor authentication helps confirm who is acting. Risk checks can pause unusual transfers for review. Authorization must be checked for every account operation." },
  { kind: "service", id: "account", label: "Account service", shape: "box", size: [1.5, 0.8, 1], color: "#4fb3c9", zone: "vpc", connectsTo: ["ledger", "account-db"], summary: "Provides account details and current balances.", details: "This service reads customer and account information. It applies account status and ownership rules before returning data to the API." },
  { kind: "ledger", id: "ledger", label: "Double-entry ledger", shape: "cylinder", size: [1, 1.1, 1], color: "#c792ea", zone: "vpc", connectsTo: ["account-db", "payments"], summary: "Records every money movement as balanced entries.", details: "A transfer debits one account and credits another. Recording both sides together preserves the accounting invariant: total debits equal total credits. Ledger entries are append-only for traceability." },
  { kind: "database", id: "account-db", label: "Bank database", shape: "cylinder", size: [0.9, 1, 0.9], color: "#a68cf0", zone: "vpc", connectsTo: [], summary: "Stores accounts, balances, and transaction records.", details: "Durable storage is protected with access controls, encryption, backups, and recovery procedures. A production bank also replicates data and monitors integrity." },
  { kind: "network", id: "payments", label: "Payment network", shape: "sphere", size: [0.75, 0.75, 0.75], color: "#ed8a72", zone: "internet", connectsTo: [], summary: "Connects the bank to other banks and payment rails.", details: "External transfers are sent through payment networks. The bank tracks each transfer through pending, settled, or failed states and reconciles external confirmations." },
];

const curatedMatches: [RegExp, string][] = [
  [/\b(llms?|chat ?gpt|gpt|rag|retrieval|language models?|inference|chatbots?|ai assistants?|generative ai|nemotron|openai)\b/i, llmPlatformScene.id],
  [/e-?commerce|amazon|flipkart|online (shop|store)|marketplace|shopping/i, ecommerceScene.id],
  [/three[- ]tier|\bweb ?app/i, threeTierScene.id],
];

/** Returns the id of a curated, hand-built scene that covers this topic, if any. */
export function matchCuratedSubject(topicInput: string): string | null {
  return curatedMatches.find(([pattern]) => pattern.test(topicInput))?.[1] ?? null;
}

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
          id, kind: (["user", "client", "service", "database", "security", "output"] as const)[index], label: index === 2 && topic.length <= 20 ? `${topic} service` : label, shape: index === 3 ? "cylinder" as const : index === 0 || index === 5 ? "sphere" as const : "box" as const,
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

export const kindOf = (c: SceneComponent): ComponentKind =>
  c.kind ?? (c.shape === "cylinder" ? "database" : c.shape === "sphere" ? "user" : "service");

export const stepsOf = (s: Scene) => [...s.components].sort((a, b) => a.step - b.step);
