"""Pre-generated high-quality 3D architecture scenes for standard systems.

These are model-generated proposed designs (NVIDIA Nemotron 3.5 Super) cached
to provide instant responses during live evaluation and demo runs without latency.
"""

from typing import Any

CACHED_SCENES: dict[str, dict[str, Any]] = {
    "uber": {
        "title": "Uber Ride-Hailing Platform",
        "description": "Model-generated proposed system design for a high-scale real-time ride matching and dispatch platform. Proposed architectural model for educational exploration.",
        "parts": [
            {
                "id": "rider-app",
                "label": "Rider Mobile App",
                "kind": "mobile",
                "zone": "internet",
                "connectsTo": ["api-gateway"],
                "summary": "Rider native mobile interface for requesting rides and live trip tracking.",
                "details": "Sends ride requests with pickup and dropoff coordinates, streams driver location updates via WebSocket.",
                "apis": "POST /v1/trips, WS /v1/trip/live",
                "dataModel": "{ rider_id: UUID, pickup: LatLng, dropoff: LatLng }",
                "failureMode": "Network loss recovers via persistent local state and idempotency tokens.",
                "tradeOffs": "Optimistic UI rendering vs exact server state confirmation.",
                "scaling": "Stateless client running locally on millions of iOS and Android devices."
            },
            {
                "id": "driver-app",
                "label": "Driver Mobile App",
                "kind": "mobile",
                "zone": "internet",
                "connectsTo": ["api-gateway"],
                "summary": "Driver mobile app broadcasting real-time location telemetry every 4 seconds.",
                "details": "Streams GPS locations, accepts trip dispatches, and handles turn-by-turn navigation events.",
                "apis": "POST /v1/driver/location, POST /v1/trips/{id}/accept",
                "dataModel": "{ driver_id: UUID, lat: float, lng: float, bearing: float }",
                "failureMode": "Buffers offline location pings when passing through tunnels.",
                "tradeOffs": "Battery consumption vs high-frequency GPS ping precision.",
                "scaling": "Edge connection multiplexing via HTTP/2 and WebSockets."
            },
            {
                "id": "api-gateway",
                "label": "API Gateway & Edge",
                "kind": "gateway",
                "zone": "vpc",
                "connectsTo": ["dispatch-service", "trip-service"],
                "summary": "High-throughput API gateway handling authentication, TLS termination, and rate limiting.",
                "details": "Routes rider requests to the trip service and driver telemetry streams to the dispatch ingestion tier.",
                "apis": "Routes incoming REST and gRPC calls",
                "failureMode": "Redundant Envoy proxies across availability zones prevent single point of failure.",
                "tradeOffs": "Centralized bottleneck vs uniform telemetry, rate limits, and audit compliance.",
                "scaling": "Auto-scaling Envoy proxy fleet behind network load balancers."
            },
            {
                "id": "dispatch-service",
                "label": "Dispatch & Matching Engine",
                "kind": "service",
                "zone": "vpc",
                "connectsTo": ["location-cache", "trip-service", "pricing-engine"],
                "summary": "Real-time geospatial matching service assigning riders to nearby available drivers.",
                "details": "Computes H3 geospatial hexagonal indexes to find candidate drivers within radius in sub-100ms.",
                "apis": "POST /internal/dispatch/match",
                "failureMode": "Falls back to wider geospatial search radii if driver acceptance times out.",
                "tradeOffs": "Greedy nearest-driver match vs batch-optimized global assignment.",
                "scaling": "Partitioned in-memory geospatial indexes sharded by geographical regions."
            },
            {
                "id": "location-cache",
                "label": "Geospatial Location Cache",
                "kind": "cache",
                "zone": "vpc",
                "connectsTo": ["dispatch-service"],
                "summary": "In-memory Redis/Memcached cluster storing active driver coordinates indexed by H3 grid.",
                "details": "Maintains ephemeral driver locations with 15-second TTL; absorbs millions of write pings per minute.",
                "dataModel": "KEY: h3_hex_id -> SET of driver_id, lat, lng, timestamp",
                "failureMode": "Driver locations self-heal upon the next 4s GPS broadcast heartbeat.",
                "tradeOffs": "Volatile memory store chosen over disk durability for high write throughput.",
                "scaling": "Redis cluster sharded by geographic cell IDs."
            },
            {
                "id": "pricing-engine",
                "label": "Surge Pricing ML Engine",
                "kind": "gpu",
                "zone": "gpu",
                "connectsTo": ["trip-service"],
                "summary": "GPU-accelerated pricing engine calculating real-time dynamic surge multipliers.",
                "details": "Predicts short-term demand-supply balance and traffic congestion using gradient boosted decision trees.",
                "apis": "POST /internal/pricing/quote",
                "failureMode": "Falls back to baseline standard distance/time rates if pricing model latency exceeds 200ms.",
                "tradeOffs": "Dynamic pricing volatility vs market clearing efficiency.",
                "scaling": "TensorRT model inference replicas deployed on GPU compute instances."
            },
            {
                "id": "trip-service",
                "label": "Trip State Management Service",
                "kind": "service",
                "zone": "vpc",
                "connectsTo": ["trip-database", "payment-service"],
                "summary": "Coordinates trip lifecycle: requested, matched, ongoing, completed, and rated.",
                "details": "Enforces trip state machine transitions and triggers invoicing and driver payouts on completion.",
                "apis": "PATCH /internal/trips/{id}/state",
                "failureMode": "Transactional outbox pattern guarantees state machine and event consistency.",
                "tradeOffs": "Strict consistency needed for trip state vs eventual consistency for analytics.",
                "scaling": "Stateless worker nodes horizontally scaled behind service mesh."
            },
            {
                "id": "trip-database",
                "label": "Durable Trip Database",
                "kind": "database",
                "zone": "vpc",
                "connectsTo": [],
                "summary": "Primary distributed SQL / PostgreSQL database for persistent trip records and billing history.",
                "details": "Stores immutable finalized trip audit logs, route waypoints, receipts, and user accounts.",
                "dataModel": "TABLE trips (trip_id UUID PRIMARY KEY, rider_id, driver_id, fare_cents, status)",
                "failureMode": "Multi-region active-passive replication with automated failover.",
                "tradeOffs": "ACID transactional safety prioritized over extreme write speeds.",
                "scaling": "Read replicas for trip history lookups and partition pruning by month."
            },
            {
                "id": "payment-service",
                "label": "Payment Gateway Service",
                "kind": "payment",
                "zone": "vpc",
                "connectsTo": ["external-psp"],
                "summary": "Handles credit card charging, digital wallet debits, and driver settlement transfers.",
                "details": "Executes payments with idempotent payment tokens and generates split fare line items.",
                "apis": "POST /internal/payments/charge",
                "failureMode": "Queues payment retries with exponential backoff on bank downtime.",
                "tradeOffs": "Synchronous authorization vs asynchronous background capture.",
                "scaling": "Isolated PCI-DSS compliant payment microservice pool."
            },
            {
                "id": "external-psp",
                "label": "External Banking & PSP Network",
                "kind": "network",
                "zone": "internet",
                "connectsTo": [],
                "summary": "External payment processors (Stripe, Adyen, Banking Rails) for card settlement.",
                "details": "Processes payments across global currencies and credit card merchant rails.",
                "apis": "POST /v1/charges, POST /v1/transfers",
                "failureMode": "Circuit breaker switches to secondary payment processor when error rates exceed threshold.",
                "tradeOffs": "Third-party dependency with external SLA constraints.",
                "scaling": "Handled by global banking infrastructure."
            }
        ],
        "overview": {
            "requirements": [
                "Sub-second dispatch and driver match for riders within geographic radius",
                "Real-time GPS telemetry ingestion from millions of concurrent drivers",
                "Zero loss of trip billing data and transactional consistency",
                "High availability (99.99%) across peak commute hours"
            ],
            "assumptions": [
                "15 million completed trips daily worldwide",
                "5 million concurrent active drivers streaming location every 4 seconds",
                "Peak write load of over 1.2 million location pings per second",
                "Read-to-write ratio of 1:10 on the live dispatch tier"
            ],
            "architecture": "A modern microservices and geospatial streaming architecture. High-frequency driver GPS coordinates stream into an in-memory Redis cluster indexed by Uber's H3 spatial hex system, while an Envoy gateway routes trip requests to a dispatch engine. Dynamic surge pricing runs on GPU inference models, and finalized trips are durably recorded in transactional SQL datastores.",
            "requestFlow": [
                "Rider opens app and requests a ride with pickup and dropoff points",
                "API Gateway authenticates rider and invokes the Dispatch Matching Engine",
                "Dispatch queries the H3 Geospatial Cache for available nearby drivers",
                "Surge Pricing Engine evaluates local demand density and returns quote",
                "Dispatch offers trip to optimal driver app via low-latency push notification",
                "Driver accepts; Trip Service transitions state to 'matched' and streams coordinates",
                "Trip completes at dropoff; Payment Service charges rider via external PSP and persists audit receipt"
            ]
        }
    },
    "netflix": {
        "title": "Netflix Streaming & Content Platform",
        "description": "Model-generated proposed system design for global video streaming, recommendation, and Open Connect CDN distribution. Proposed educational architectural model.",
        "parts": [
            {
                "id": "netflix-client",
                "label": "Smart TV & Mobile App",
                "kind": "client",
                "zone": "internet",
                "connectsTo": ["edge-gateway", "open-connect-cdn"],
                "summary": "Client streaming application running on TVs, web browsers, and mobile devices.",
                "details": "Performs adaptive bitrate switching (HLS/DASH) to ensure bufferless playback.",
                "apis": "GET /playback/manifest, POST /playback/telemetry",
                "failureMode": "Dynamically downgrades resolution when network bandwidth drops.",
                "tradeOffs": "Client-side buffer memory vs latency to start playback.",
                "scaling": "Client apps deployed across billions of connected television devices."
            },
            {
                "id": "open-connect-cdn",
                "label": "Open Connect Global CDN",
                "kind": "edge",
                "zone": "internet",
                "connectsTo": [],
                "summary": "Custom content delivery appliances installed directly inside global ISP networks.",
                "details": "Serves over 95% of video traffic locally from ISP peering points, eliminating transit costs.",
                "apis": "GET /video/chunks/{chunk_hash}",
                "failureMode": "Automatic DNS and manifest redirection to adjacent ISP cache appliances.",
                "tradeOffs": "Massive edge storage hardware footprints vs global backbone transit costs.",
                "scaling": "Petabytes of high-speed flash and disk storage embedded in thousands of ISP locations."
            },
            {
                "id": "edge-gateway",
                "label": "Zuul Edge Gateway",
                "kind": "gateway",
                "zone": "vpc",
                "connectsTo": ["playback-service", "recommendation-service"],
                "summary": "Intelligent edge proxy handling routing, security filters, and canary testing.",
                "details": "Terminates HTTPS, evaluates device DRM tokens, and routes traffic to backend microservices.",
                "apis": "Routes /api/v1/* traffic",
                "failureMode": "Resilient circuit breaking and shed-load shedding on upstream degradation.",
                "tradeOffs": "Complex filter pipelines vs granular edge routing control.",
                "scaling": "Horizontally scaled stateless JVM instances on AWS compute."
            },
            {
                "id": "playback-service",
                "label": "Playback Authorization Service",
                "kind": "service",
                "zone": "vpc",
                "connectsTo": ["user-database", "open-connect-cdn"],
                "summary": "Validates subscription entitlement, licenses, and selects optimal CDN appliances.",
                "details": "Generates signed playback manifests detailing chunk URLs and DRM keys for the requested title.",
                "apis": "POST /playback/authorize",
                "failureMode": "Graceful fallback allows playback using cached subscription entitlements.",
                "tradeOffs": "Strict DRM verification vs sub-second title start times.",
                "scaling": "Stateless service running across multi-region clusters."
            },
            {
                "id": "recommendation-service",
                "label": "Personalization & Ranking Engine",
                "kind": "gpu",
                "zone": "gpu",
                "connectsTo": ["viewing-history-db"],
                "summary": "Deep learning recommendation system tailoring homepage video rows and artwork for each profile.",
                "details": "Executes contextual collaborative filtering and visual artwork bandits on GPU clusters.",
                "apis": "GET /recommendations/home-grid",
                "failureMode": "Serves precomputed top-10 trending titles if real-time model inference times out.",
                "tradeOffs": "Complex multi-stage neural models vs sub-50ms homepage render deadlines.",
                "scaling": "NVIDIA GPU inference instances handling distributed embedding lookups."
            },
            {
                "id": "viewing-history-db",
                "label": "Cassandra Viewing History Store",
                "kind": "database",
                "zone": "vpc",
                "connectsTo": [],
                "summary": "Highly available distributed NoSQL database storing user watch timestamps and bookmarks.",
                "details": "Provides masterless writes across availability zones to record exact playback pause markers.",
                "dataModel": "TABLE viewing_history (account_id, profile_id, title_id, pause_second, updated_at)",
                "failureMode": "Eventual consistency model ensures writes succeed even under partition.",
                "tradeOffs": "Eventual consistency vs strong linearizable reads.",
                "scaling": "Wide-column Apache Cassandra clusters partitioned by account ID."
            },
            {
                "id": "video-transcoding",
                "label": "Video Encoding & Transcoding Pipeline",
                "kind": "warehouse",
                "zone": "vpc",
                "connectsTo": ["open-connect-cdn"],
                "summary": "Distributed batch chunk encoding pipeline generating multi-bitrate AV1, HEVC, and VP9 streams.",
                "details": "Splits 4K master videos into 3-second chunks and encodes them concurrently across thousands of nodes.",
                "apis": "Internal orchestrator pipeline",
                "failureMode": "Failed chunk transcode tasks automatically rescheduled on healthy worker spot instances.",
                "tradeOffs": "High computing investment up front vs minimal streaming bandwidth during playback.",
                "scaling": "Serverless spot compute instances scaling up for new title releases."
            },
            {
                "id": "user-database",
                "label": "User & Billing Relational Store",
                "kind": "database",
                "zone": "vpc",
                "connectsTo": [],
                "summary": "Relational datastore tracking member subscriptions, credit cards, and active profiles.",
                "details": "Ensures ACID consistency for account tier upgrades, renewals, and simultaneous stream limits.",
                "dataModel": "TABLE accounts (id UUID, email, subscription_tier, status, max_streams)",
                "failureMode": "Synchronous standby replica failover with zero data loss.",
                "tradeOffs": "Strict relational integrity vs horizontal scaling complexity.",
                "scaling": "Clustered PostgreSQL with sharded read replicas."
            }
        ],
        "overview": {
            "requirements": [
                "Sub-second video playback initiation with zero initial buffering",
                "Continuous adaptive bitrate streaming up to 4K Dolby Vision",
                "Personalized home screen recommendations computed for 250M+ users",
                "High availability architecture resilient against AWS region outages"
            ],
            "assumptions": [
                "260+ million paid memberships globally",
                "Average 3.2 hours of streaming per subscriber per day",
                "Over 100 Terabits/second of peak video egress served worldwide",
                "95% of video bits delivered directly from ISP Open Connect appliances"
            ],
            "architecture": "Netflix employs a hybrid cloud architecture: the control plane, user metadata, and recommendation models run in cloud regions, while actual video bits are served directly from custom Open Connect appliances placed inside Internet Service Providers worldwide. Microservices communicate via asynchronous messaging and resilient circuit-broken gateways.",
            "requestFlow": [
                "User launches smart TV app and requests home screen",
                "Zuul Gateway authenticates profile and queries the Recommendation Engine",
                "Recommendation Engine evaluates viewing history and returns personalized title rows",
                "User presses Play on a title; Playback Service verifies license and DRM",
                "Playback Service identifies the closest Open Connect CDN appliance in user's ISP",
                "Client connects directly to local Open Connect appliance and streams video chunks",
                "Telemetry service reports playback quality metrics back to Cassandra store"
            ]
        }
    },
    "chatgpt": {
        "title": "ChatGPT Conversational AI Platform",
        "description": "Model-generated proposed system design for high-concurrency conversational LLM inference, context retrieval, and safety moderation. Proposed educational architectural model.",
        "parts": [
            {
                "id": "web-mobile-ui",
                "label": "Web & Mobile Client",
                "kind": "client",
                "zone": "internet",
                "connectsTo": ["api-gateway"],
                "summary": "Interactive chat interface rendering streaming markdown and code blocks in real time.",
                "details": "Maintains persistent SSE (Server-Sent Events) or WebSocket connections for streaming token deltas.",
                "apis": "POST /v1/chat/completions (stream=true)",
                "failureMode": "Auto-reconnects with last received token index on connection drops.",
                "tradeOffs": "Real-time token rendering vs bulk response caching.",
                "scaling": "Stateless React client distributed via global edge CDNs."
            },
            {
                "id": "api-gateway",
                "label": "Cloudflare Edge & Gateway",
                "kind": "gateway",
                "zone": "vpc",
                "connectsTo": ["moderation-guard", "session-service"],
                "summary": "Edge security proxy managing DDoS defense, bot protection, and auth rate limiting.",
                "details": "Enforces user subscription tiers (Free vs Plus/Team) and routes requests to model dispatch tiers.",
                "apis": "Routes /v1/* endpoints",
                "failureMode": "Edge rate limits return HTTP 429 with Retry-After headers during traffic surges.",
                "tradeOffs": "Aggressive bot verification vs frictionless user onboarding.",
                "scaling": "Anycast edge infrastructure handling millions of concurrent requests."
            },
            {
                "id": "moderation-guard",
                "label": "Safety & Moderation Filter",
                "kind": "ai",
                "zone": "vpc",
                "connectsTo": ["inference-router"],
                "summary": "Ultra-fast classifier inspecting user prompts and model completions for safety violations.",
                "details": "Executes low-latency binary classification to intercept prompt injections, PII, and policy violations.",
                "apis": "POST /internal/moderate",
                "failureMode": "Fails safe by blocking high-confidence hazardous prompts.",
                "tradeOffs": "Latency overhead (15ms) vs brand safety and compliance guarantee.",
                "scaling": "Quantized model instances running on CPU/GPU clusters."
            },
            {
                "id": "session-service",
                "label": "Session & Context Assembler",
                "kind": "service",
                "zone": "vpc",
                "connectsTo": ["conversation-db", "vector-memory"],
                "summary": "Assembles multi-turn chat history and applies sliding token window budgeting.",
                "details": "Fetches past conversation turns, formats chat templates, and merges retrieved user memory contexts.",
                "apis": "POST /internal/context/build",
                "failureMode": "Truncates oldest conversational turns if context limit is exceeded.",
                "tradeOffs": "Full conversational history vs GPU KV cache memory footprint.",
                "scaling": "Stateless microservice autoscaled on CPU nodes."
            },
            {
                "id": "vector-memory",
                "label": "Vector Memory & RAG Store",
                "kind": "vector",
                "zone": "vpc",
                "connectsTo": ["inference-router"],
                "summary": "Dense vector database storing user custom instructions, documents, and long-term memory.",
                "details": "Performs cosine similarity search using Nemotron embeddings to retrieve relevant facts.",
                "apis": "POST /internal/vectors/query",
                "dataModel": "VECTOR(2048) with HNSW index and user_id partition filter",
                "failureMode": "Returns prompt without memory augmentation if vector query times out.",
                "tradeOffs": "Retrieval recall vs latency budget.",
                "scaling": "Sharded Milvus or Pinecone cluster partitioned by tenant ID."
            },
            {
                "id": "inference-router",
                "label": "Inference Queue & Router",
                "kind": "agent",
                "zone": "vpc",
                "connectsTo": ["tensorrt-cluster"],
                "summary": "Dynamic continuous-batching orchestrator dispatching tokens to GPU engine clusters.",
                "details": "Implements vLLM / TensorRT-LLM PagedAttention continuous batching to maximize GPU utilization.",
                "apis": "gRPC streaming dispatch",
                "failureMode": "Gracefully queues pending generation requests during peak traffic bursts.",
                "tradeOffs": "First-token time to response (TTFT) vs overall throughput per GPU.",
                "scaling": "Distributed scheduler mapping prompt lengths to optimal engine pools."
            },
            {
                "id": "tensorrt-cluster",
                "label": "NVIDIA TensorRT-LLM GPU Cluster",
                "kind": "gpu",
                "zone": "gpu",
                "connectsTo": ["conversation-db"],
                "summary": "High-performance GPU cluster running Nemotron / transformer models with Tensor Core acceleration.",
                "details": "Executes tensor-parallel forward passes, streams tokens via KV-caching, and computes logits.",
                "apis": "Internal engine stream",
                "failureMode": "Node failover restarts generation on adjacent replica with warm prefix cache.",
                "tradeOffs": "FP8 / INT4 quantization speedups vs slight perplexity precision.",
                "scaling": "Clusters of NVIDIA HGX H100 / Blackwell systems interconnected via NVLink."
            },
            {
                "id": "conversation-db",
                "label": "Conversation History Datastore",
                "kind": "database",
                "zone": "vpc",
                "connectsTo": [],
                "summary": "Durable distributed database recording complete chat transcripts and metadata.",
                "details": "Stores user messages, assistant completions, token usage stats, and feedback thumbs up/down.",
                "dataModel": "TABLE conversations (id UUID, user_id, title, messages JSONB, created_at)",
                "failureMode": "Asynchronous persistence avoids blocking the active token streaming loop.",
                "tradeOffs": "Asynchronous persistence vs instant query-after-write consistency.",
                "scaling": "Distributed PostgreSQL or CockroachDB with horizontal partitioning."
            }
        ],
        "overview": {
            "requirements": [
                "Sub-500ms Time-To-First-Token (TTFT) for interactive conversational feel",
                "Streaming token delivery over persistent HTTP SSE connections",
                "Robust safety moderation guardrails on both prompts and outputs",
                "Scalable support for hundreds of millions of weekly active learners"
            ],
            "assumptions": [
                "100+ million weekly active users",
                "Average chat turn length of 80 prompt tokens and 350 generation tokens",
                "Thousands of GPU accelerators running in continuous batching clusters",
                "P99 token generation latency under 30ms per token"
            ],
            "architecture": "The conversational AI platform pairs an edge gateway and safety moderation filter with an intelligent context assembler and high-throughput GPU inference cluster. NVIDIA TensorRT-LLM with PagedAttention continuous batching powers real-time token generation, streaming output back through SSE to the user client.",
            "requestFlow": [
                "User submits a query in the web or mobile client interface",
                "Cloudflare edge authenticates the token and verifies rate limits",
                "Moderation Guard scans user prompt for safety and injection risks",
                "Session Service retrieves prior turn history and vector memory context",
                "Inference Router places request into the continuous batching scheduler",
                "NVIDIA TensorRT-LLM GPU cluster generates tokens using KV-caching",
                "Tokens stream incrementally back through SSE connection to user screen",
                "Completed transcript is asynchronously persisted to the Conversation Database"
            ]
        }
    },
    "whatsapp": {
        "title": "WhatsApp Messaging Platform",
        "description": "Model-generated proposed system design for end-to-end encrypted messaging, presence detection, and media delivery. Proposed educational architectural model.",
        "parts": [
            {
                "id": "mobile-client",
                "label": "Mobile Messaging Client",
                "kind": "mobile",
                "zone": "internet",
                "connectsTo": ["chat-gateway"],
                "summary": "Client holding Signal Protocol private keys for local end-to-end encryption.",
                "details": "Maintains a long-lived persistent TCP connection and stores chat history locally on device.",
                "apis": "TCP persistent socket connection",
                "failureMode": "Queues unsent messages locally in SQLite until network connection resumes.",
                "tradeOffs": "Local encryption storage security vs cloud-wide chat backup convenience.",
                "scaling": "Over 2 billion active mobile clients running on diverse mobile hardware."
            },
            {
                "id": "chat-gateway",
                "label": "Erlang Chat Connection Gateway",
                "kind": "gateway",
                "zone": "vpc",
                "connectsTo": ["session-manager", "message-service"],
                "summary": "Massively concurrent Erlang / BEAM connection servers maintaining active socket channels.",
                "details": "Holds millions of concurrent idle TCP socket connections per server with tiny memory footprints.",
                "apis": "Binary protocol over TLS",
                "failureMode": "Heartbeat keepalives detect severed connections and trigger clean reconnects.",
                "tradeOffs": "Stateful socket connections vs stateless HTTP microservices.",
                "scaling": "Erlang processes consuming less than 2KB memory per active connection."
            },
            {
                "id": "session-manager",
                "label": "Presence & Session Service",
                "kind": "service",
                "zone": "vpc",
                "connectsTo": ["presence-cache"],
                "summary": "Tracks user online status, last seen timestamps, and active connection gateway mapping.",
                "details": "Enables instant routing of messages to the exact gateway server holding the recipient's socket.",
                "apis": "GET/POST /internal/session/{user_id}",
                "failureMode": "Presence fails open (marks offline) without interrupting message delivery.",
                "tradeOffs": "Battery optimization vs real-time presence ping granularity.",
                "scaling": "In-memory distributed hash tables sharded across gateway clusters."
            },
            {
                "id": "presence-cache",
                "label": "Ephemeral Presence Cache",
                "kind": "cache",
                "zone": "vpc",
                "connectsTo": [],
                "summary": "Low-latency Redis or in-memory key-value cluster maintaining active heartbeat leases.",
                "details": "Keys expire after 60 seconds unless renewed by client connection keepalive pings.",
                "dataModel": "KEY: user_id -> { gateway_id, last_heartbeat, status }",
                "failureMode": "Immediate expiration cleanly clears stale ghost connections.",
                "tradeOffs": "High read/write cache load vs persistent storage cost.",
                "scaling": "Redis cluster sharded by user phone number hash."
            },
            {
                "id": "message-service",
                "label": "Message Dispatcher & Queue",
                "kind": "service",
                "zone": "vpc",
                "connectsTo": ["offline-queue-db", "push-notification-service"],
                "summary": "Routes encrypted message payloads to online recipients or queues for offline delivery.",
                "details": "Does not decrypt messages; handles encrypted envelope routing and delivery receipts (double tick).",
                "apis": "POST /internal/message/deliver",
                "failureMode": "If recipient is offline, enqueues to the offline storage datastore.",
                "tradeOffs": "Zero server-side message inspection vs advanced server-side search features.",
                "scaling": "Stateless Erlang actor processes dispatching messages concurrently."
            },
            {
                "id": "offline-queue-db",
                "label": "Offline Message Queue Store",
                "kind": "database",
                "zone": "vpc",
                "connectsTo": [],
                "summary": "Durable queue storing encrypted messages until offline recipients reconnect.",
                "details": "Immediately deletes encrypted message payloads once the client acknowledges delivery.",
                "dataModel": "TABLE offline_messages (recipient_id, message_id, encrypted_payload, created_at)",
                "failureMode": "Replicated across disks; retained for up to 30 days then discarded.",
                "tradeOffs": "Store-and-delete privacy model vs permanent server backup storage.",
                "scaling": "Clustered Cassandra or RocksDB with high append write speeds."
            },
            {
                "id": "media-storage",
                "label": "Encrypted Media Warehouse",
                "kind": "warehouse",
                "zone": "vpc",
                "connectsTo": [],
                "summary": "Content addressable object storage hosting ciphertext images, voice notes, and videos.",
                "details": "Stores end-to-end encrypted media blobs referenced by SHA-256 hash in chat messages.",
                "apis": "PUT /media/{hash}, GET /media/{hash}",
                "failureMode": "Ciphertext blobs automatically pruned after 30 days if downloaded.",
                "tradeOffs": "Temporary cloud staging vs permanent cloud media libraries.",
                "scaling": "Petabyte-scale distributed object storage backed by CDN edge caching."
            },
            {
                "id": "push-notification-service",
                "label": "Push Notification Gateway",
                "kind": "network",
                "zone": "internet",
                "connectsTo": [],
                "summary": "Interoperates with mobile push-notification services to wake offline devices.",
                "details": "Dispatches high-priority silent or alert push notifications when new messages arrive.",
                "apis": "POST /apns/notify, POST /fcm/notify",
                "failureMode": "Retries failed push notifications with exponential backoff.",
                "tradeOffs": "External OS vendor dependency for device wake up.",
                "scaling": "Asynchronous event workers consuming message queues."
            }
        ],
        "overview": {
            "requirements": [
                "End-to-end encryption for all messages and calls using the Signal Protocol",
                "Sub-100ms real-time message delivery between online users worldwide",
                "Store-and-delete server architecture: messages deleted immediately after delivery",
                "Minimal bandwidth and battery consumption on mobile devices"
            ],
            "assumptions": [
                "2+ billion active users globally",
                "Over 100 billion messages dispatched per day",
                "Up to 2 million concurrent TCP connections held per Erlang gateway server",
                "Peak traffic periods during global holidays reaching 1.5M msgs/sec"
            ],
            "architecture": "WhatsApp leverages high-concurrency Erlang/BEAM socket servers to maintain persistent lightweight connections with billions of mobile devices. A presence and routing layer maps messages directly between active client sockets, while offline messages are temporarily buffered in a high-speed write store and purged as soon as delivery is confirmed.",
            "requestFlow": [
                "Sender client encrypts message locally with recipient's Signal public key",
                "Sender transmits encrypted envelope over persistent TCP connection to Erlang Gateway",
                "Gateway consults the Presence Service to check if recipient is online",
                "If online, message is routed immediately to recipient's active gateway connection",
                "Recipient client acknowledges receipt; server forwards 'delivered' status back to sender",
                "If recipient is offline, message is stored in Offline Queue DB and Push Notification is sent",
                "Recipient reconnects, downloads queued messages, and server deletes payloads permanently"
            ]
        }
    },
    "instagram": {
        "title": "Instagram Social Media Platform",
        "description": "Model-generated proposed system design for photo/video sharing, social graph interactions, and personalized home feed fan-out. Proposed educational architectural model.",
        "parts": [
            {
                "id": "mobile-app",
                "label": "Instagram Mobile App",
                "kind": "mobile",
                "zone": "internet",
                "connectsTo": ["cdn-edge"],
                "summary": "Native iOS and Android client rendering infinite scroll feed, stories, and reels.",
                "details": "Prefetches upcoming media chunks and caches recently viewed images in local device memory.",
                "apis": "GET /v1/feed, POST /v1/media/upload",
                "failureMode": "Displays cached timeline when offline or experiencing poor connectivity.",
                "tradeOffs": "Prefetching data consumption vs instant scroll fluidity.",
                "scaling": "Billions of daily active mobile installations."
            },
            {
                "id": "cdn-edge",
                "label": "Global CDN Edge",
                "kind": "edge",
                "zone": "internet",
                "connectsTo": ["api-gateway"],
                "summary": "Global Edge PoPs caching optimized WebP images, Story videos, and Reels clips.",
                "details": "Terminates TLS, compresses payloads, and absorbs over 90% of all static media requests.",
                "apis": "GET /images/{hash}, GET /videos/{hash}",
                "failureMode": "Automatic origin fallback if edge cache misses.",
                "tradeOffs": "Edge caching cost vs origin datacenter bandwidth savings.",
                "scaling": "Global Anycast edge network with terabit capacity."
            },
            {
                "id": "api-gateway",
                "label": "API Gateway & Router",
                "kind": "gateway",
                "zone": "vpc",
                "connectsTo": ["feed-service", "post-service"],
                "summary": "Unified gateway handling request routing, OAuth authentication, and rate limiting.",
                "details": "Directs feed generation calls to the Feed Service and upload workflows to media ingestion.",
                "apis": "Routes /api/* microservices",
                "failureMode": "Per-user and per-IP token bucket rate limiting prevents abuse.",
                "tradeOffs": "Centralized ingress vs distributed microservice endpoints.",
                "scaling": "Auto-scaling stateless reverse proxy fleet."
            },
            {
                "id": "feed-service",
                "label": "Feed Aggregation Service",
                "kind": "service",
                "zone": "vpc",
                "connectsTo": ["social-graph-db", "feed-cache", "ranking-engine"],
                "summary": "Constructs personalized home timelines combining followed accounts and suggested posts.",
                "details": "Executes hybrid fan-out on write (for normal users) and fan-out on read (for celebrities).",
                "apis": "GET /internal/feed/generate",
                "failureMode": "Falls back to reverse-chronological timeline if ranking model is slow.",
                "tradeOffs": "Fan-out on write storage cost vs fan-out on read latency.",
                "scaling": "Horizontally autoscaling microservice pods."
            },
            {
                "id": "ranking-engine",
                "label": "ML Feed Ranking Engine",
                "kind": "gpu",
                "zone": "gpu",
                "connectsTo": ["feed-cache"],
                "summary": "GPU-accelerated two-stage recommendation model ranking candidate posts by engagement likelihood.",
                "details": "Evaluates user interactions, creator affinity, and content topics to score feed items.",
                "apis": "POST /internal/ranking/score",
                "failureMode": "Returns heuristic score based on recency and like counts during GPU spikes.",
                "tradeOffs": "High computational cost per impression vs maximized user engagement.",
                "scaling": "Distributed deep learning inference clusters on GPU hardware."
            },
            {
                "id": "feed-cache",
                "label": "User Feed Cache",
                "kind": "cache",
                "zone": "vpc",
                "connectsTo": [],
                "summary": "In-memory Redis/Memcached cluster storing precomputed top 500 post IDs per user.",
                "details": "Allows sub-20ms timeline retrieval for instant app launch experiences.",
                "dataModel": "KEY: user_id -> LIST of post_ids",
                "failureMode": "Recomputed on demand from follower graph if cache key misses.",
                "tradeOffs": "Memory footprint for dormant users vs instant feed retrieval.",
                "scaling": "Partitioned in-memory clusters sharded by user ID."
            },
            {
                "id": "post-service",
                "label": "Media Upload & Post Service",
                "kind": "service",
                "zone": "vpc",
                "connectsTo": ["media-warehouse", "posts-database"],
                "summary": "Processes media uploads, coordinates transcoding, and publishes post records.",
                "details": "Validates image/video formats, extracts EXIF data, and generates multiple thumbnail resolutions.",
                "apis": "POST /internal/posts/create",
                "failureMode": "Resumable uploads allow clients to retry failed chunk transfers.",
                "tradeOffs": "Immediate post availability vs completion of all video transcode variants.",
                "scaling": "Asynchronous background worker pools handling encoding."
            },
            {
                "id": "media-warehouse",
                "label": "Media Blob Storage",
                "kind": "warehouse",
                "zone": "vpc",
                "connectsTo": ["cdn-edge"],
                "summary": "Scalable object datastore housing petabytes of original and transcoded photos and reels.",
                "details": "Stores raw master assets with multi-region redundancy and distributes to CDN edge caches.",
                "apis": "S3-compatible object API",
                "failureMode": "Automated object versioning and cross-region replication.",
                "tradeOffs": "Long-term cold storage costs vs instant video retrieval.",
                "scaling": "Distributed cloud object storage with infinite horizontal expansion."
            },
            {
                "id": "social-graph-db",
                "label": "Social Graph Database",
                "kind": "database",
                "zone": "vpc",
                "connectsTo": [],
                "summary": "Graph database / TAO distributed cache mapping follower and following relationships.",
                "details": "Optimized for high-fanout traversal of follower lists to support timeline construction.",
                "dataModel": "Edges: (user_A, 'follows', user_B, timestamp)",
                "failureMode": "Read replicas absorb follower lookup spikes during viral events.",
                "tradeOffs": "Complex bidirectional graph consistency vs fast relationship traversal.",
                "scaling": "Distributed graph storage partitioned by user node IDs."
            },
            {
                "id": "posts-database",
                "label": "Posts & Comments Database",
                "kind": "database",
                "zone": "vpc",
                "connectsTo": [],
                "summary": "Primary sharded relational datastore storing post captions, likes, and comments.",
                "details": "Handles ACID transactions for like increments, comments, and post metadata.",
                "dataModel": "TABLE posts (post_id UUID, user_id, caption, media_url, like_count, created_at)",
                "failureMode": "Read replica failover and write-ahead log backups.",
                "tradeOffs": "Strong transactional guarantees vs horizontal sharding maintenance.",
                "scaling": "Sharded PostgreSQL or MySQL clusters with vitess routing."
            }
        ],
        "overview": {
            "requirements": [
                "Sub-second home feed generation with personalized post ranking",
                "Smooth video Reels and Stories playback with zero stuttering",
                "Resilient social graph traversal for accounts with tens of millions of followers",
                "99.99% availability for photo and video uploads across global timezones"
            ],
            "assumptions": [
                "2+ billion monthly active users",
                "Over 500 million daily active Stories and Reels creators",
                "100+ million new photo and video uploads published daily",
                "99% of media requests served from CDN edge cache"
            ],
            "architecture": "Instagram utilizes a hybrid fan-out architecture: standard user posts fan out to followers' in-memory feed caches upon publish, while celebrity posts are merged at read time to avoid fan-out write amplification. High-capacity object stores and global CDNs deliver media, while GPU clusters compute personalized feed rankings.",
            "requestFlow": [
                "User opens app; request routes through CDN Edge to API Gateway",
                "Feed Service checks in-memory User Feed Cache for precomputed post IDs",
                "If cache miss, Feed Service queries Social Graph to find recent followed posts",
                "ML Feed Ranking Engine scores candidate posts using engagement affinity models",
                "Feed Service fetches post metadata and comments from Posts Database",
                "Client displays timeline and streams photo/video assets directly from closest CDN Edge",
                "User likes a post; asynchronous event updates like counter and re-tunes user ranking preferences"
            ]
        }
    }
}
