# CAM MISSION 001 – REVISED IMPLEMENTATION PLAN (PHASE 1)

**Status**: FINAL REVISION — Ready for Approval Before Code

**Date**: 2026-08-19

**Scope**: Minimal MVP proving core orchestration loop: Request → CAM → Classify → Route → Execute → Synthesize → User Response

---

## 1. DESIGN PRINCIPLES

✅ **Mobile-First Architecture** — Backend designed for mobile client from day one
✅ **Minimal Viable Proof** — Only prove orchestration + routing + 2 providers  
✅ **Replaceable Strategies** — Routing strategy swappable without refactoring
✅ **Synchronous MVP** — No async job queues, no WebSockets (add later)
✅ **Simple Sessions** — Device/session ID, not JWT (add later)
✅ **Provider Extensibility** — Adapters structure allows new providers without core changes
✅ **Deferrable Infrastructure** — Project memory, documents, caching all deferred

---

## 2. TECHNOLOGY STACK (MINIMAL)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Backend Runtime** | Node.js 20 + TypeScript | Type safety for routing logic, easy provider integration |
| **HTTP Framework** | Express.js (lightweight) | Minimal overhead, perfect for mobile API |
| **HTTP Client** | node-fetch or axios | Simple, no heavy dependencies |
| **Configuration** | dotenv | Environment-based provider keys |
| **Testing** | Jest | Unit + integration tests only |
| **Development** | Local docker-compose (optional) | Single PostgreSQL if testing DB persistence |
| **Documentation** | OpenAPI 3.0 YAML | Auto-generate client SDKs |

**Explicit Deferrals**:
- ❌ PostgreSQL (no persistent memory yet)
- ❌ Redis (no caching)
- ❌ Bull (no async jobs)
- ❌ S3/Document storage
- ❌ Telemetry/Prometheus
- ❌ Admin dashboards
- ❌ WebSocket

---

## 3. SYSTEM ARCHITECTURE (MINIMAL)

```
┌─────────────────────────────────────────────────────────────────┐
│                      MOBILE CLIENT                              │
│  (iOS/Android/Web prototype - lightweight form + results)       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ POST /api/v1/requests
                         │ { text, sessionId }
                         │
                         ▼
        ┌────────────────────────────────────┐
        │     EXPRESS API GATEWAY            │
        │  (Single entry point)              │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │    REQUEST VALIDATION              │
        │  (Basic sanity check)              │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │    CAM CLASSIFIER                  │
        │  (Keyword matching strategy)       │
        │  Outputs: capability_category      │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │   CAPABILITY ROUTER                │
        │  (Map capability → provider)       │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │   PROVIDER REGISTRY                │
        │  (Resolve provider adapter)        │
        └────────────┬───────────────────────┘
                     │
         ┌───────────┴─────────────┐
         │                         │
         ▼                         ▼
    ┌─────────────┐          ┌──────────────┐
    │ DeepSeek    │          │ Perplexity   │
    │ Adapter     │          │ Adapter      │
    │             │          │              │
    │ (sync call) │          │ (sync call)  │
    └──────┬──────┘          └───────┬──────┘
           │                        │
           └────────────┬───────────┘
                        │
                        ▼
           ┌────────────────────────────────┐
           │  RESULT SYNTHESIS              │
           │  (Combine single response +    │
           │   add metadata)                │
           └────────────┬───────────────────┘
                        │
                        ▼
           ┌────────────────────────────────┐
           │  FORMAT RESPONSE               │
           │  (JSON with provider + text)   │
           └────────────┬───────────────────┘
                        │
                        ▼ 200 OK
              { text, provider, metadata }
```

**Key Constraint**: Synchronous only. No background jobs. Client waits for response.

---

## 4. CAPABILITY-ORIENTED ROUTING (MVP Strategy)

**Concept**: Request maps to *capability*, capability maps to *provider*.

This allows future routing strategies to replace keyword matching without touching provider logic.

### 4.1 Capability Categories (MVP)

```typescript
enum Capability {
  DEVELOPMENT = "DEVELOPMENT",        // Code, debugging, architecture
  RESEARCH = "RESEARCH",              // Web search, current info
  GENERAL = "GENERAL",                // Fallback, general knowledge
}
```

### 4.2 Classifier Strategy (Interface)

```typescript
interface ClassificationStrategy {
  classify(request: UserRequest): Capability;
}

// Initial implementation: KeywordClassifier
// Future implementations: SemanticClassifier, MLClassifier, etc.
```

### 4.3 Routing Table (Hardcoded, MVP)

```typescript
const CAPABILITY_TO_PROVIDER: Record<Capability, string> = {
  [Capability.DEVELOPMENT]: "deepseek",
  [Capability.RESEARCH]: "perplexity",
  [Capability.GENERAL]: "deepseek",  // Fallback
};
```

### 4.4 Classifier Implementation (Keyword-Based)

```typescript
// src/orchestration/classifiers/keyword-classifier.ts
class KeywordClassifier implements ClassificationStrategy {
  classify(request: UserRequest): Capability {
    const text = request.text.toLowerCase();

    // Check DEVELOPMENT keywords
    if (this.containsAny(text, [
      "code", "implement", "debug", "function", "class", "api", 
      "algorithm", "refactor", "optimize", "architecture"
    ])) {
      return Capability.DEVELOPMENT;
    }

    // Check RESEARCH keywords
    if (this.containsAny(text, [
      "research", "find", "current", "latest", "news", "search",
      "what is the", "how do i find", "where can i"
    ])) {
      return Capability.RESEARCH;
    }

    // Default
    return Capability.GENERAL;
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(kw => text.includes(kw));
  }
}
```

**Extensibility**: New classifiers can be injected at runtime or configured via env var.

---

## 5. PROVIDER ADAPTER INTERFACE

### 5.1 Base Adapter Contract

```typescript
// src/providers/adapter.ts
interface ProviderAdapter {
  /**
   * Execute a request with this provider.
   * Synchronous (no promises for MVP simplicity, or light promise support).
   */
  call(request: UserRequest): Promise<ProviderResponse>;

  /**
   * Validate that provider is configured correctly.
   */
  validate(): Promise<void>;

  /**
   * Get provider metadata (name, capabilities, etc).
   */
  metadata(): ProviderMetadata;
}

interface ProviderMetadata {
  name: string;
  capabilities: Capability[];
  version: string;
  configRequired: string[];  // List of env vars needed
}

interface ProviderResponse {
  provider: string;
  text: string;
  metadata: {
    tokensUsed?: number;
    latencyMs: number;
    modelUsed: string;
  };
}
```

### 5.2 Provider Registry (Dependency Injection)

```typescript
// src/providers/registry.ts
class ProviderRegistry {
  private providers: Map<string, ProviderAdapter> = new Map();

  register(name: string, adapter: ProviderAdapter) {
    this.providers.set(name, adapter);
  }

  get(name: string): ProviderAdapter {
    const adapter = this.providers.get(name);
    if (!adapter) {
      throw new Error(`Provider "${name}" not registered`);
    }
    return adapter;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Bootstrap in app.ts
const registry = new ProviderRegistry();
registry.register("deepseek", new DeepSeekAdapter());
registry.register("perplexity", new PerplexityAdapter());
```

### 5.3 DeepSeek Adapter (Implementation)

```typescript
// src/providers/deepseek/adapter.ts
class DeepSeekAdapter implements ProviderAdapter {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || "";
    this.model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  }

  async call(request: UserRequest): Promise<ProviderResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: request.text }],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      return {
        provider: "deepseek",
        text: content,
        metadata: {
          latencyMs: Date.now() - startTime,
          modelUsed: this.model,
          tokensUsed: data.usage?.total_tokens,
        },
      };
    } catch (error) {
      throw new Error(`DeepSeek call failed: ${error.message}`);
    }
  }

  async validate(): Promise<void> {
    if (!this.apiKey) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }
  }

  metadata(): ProviderMetadata {
    return {
      name: "deepseek",
      capabilities: [Capability.DEVELOPMENT, Capability.GENERAL],
      version: "1.0",
      configRequired: ["DEEPSEEK_API_KEY"],
    };
  }
}
```

### 5.4 Perplexity Adapter (Implementation)

```typescript
// src/providers/perplexity/adapter.ts
class PerplexityAdapter implements ProviderAdapter {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || "";
    this.model = process.env.PERPLEXITY_MODEL || "pplx-7b-online";
  }

  async call(request: UserRequest): Promise<ProviderResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: request.text }],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      return {
        provider: "perplexity",
        text: content,
        metadata: {
          latencyMs: Date.now() - startTime,
          modelUsed: this.model,
          tokensUsed: data.usage?.total_tokens,
        },
      };
    } catch (error) {
      throw new Error(`Perplexity call failed: ${error.message}`);
    }
  }

  async validate(): Promise<void> {
    if (!this.apiKey) {
      throw new Error("PERPLEXITY_API_KEY not configured");
    }
  }

  metadata(): ProviderMetadata {
    return {
      name: "perplexity",
      capabilities: [Capability.RESEARCH, Capability.GENERAL],
      version: "1.0",
      configRequired: ["PERPLEXITY_API_KEY"],
    };
  }
}
```

### 5.5 Future Provider Adapter Template

```typescript
// src/providers/gemini/adapter.ts (STUB - DO NOT IMPLEMENT IN PHASE 1)
class GeminiAdapter implements ProviderAdapter {
  async call(request: UserRequest): Promise<ProviderResponse> {
    throw new Error("Gemini adapter not yet implemented");
  }

  async validate(): Promise<void> {
    throw new Error("Gemini not configured for Phase 1");
  }

  metadata(): ProviderMetadata {
    return {
      name: "gemini",
      capabilities: [],
      version: "0.0",
      configRequired: [],
    };
  }
}
```

---

## 6. MOBILE API CONTRACT (OpenAPI 3.0)

### 6.1 POST /api/v1/requests

**Purpose**: Submit a user request and get a response.

**Request**:
```json
{
  "text": "How do I implement JWT authentication in Node.js?",
  "sessionId": "device_abc123_session_001"  // Optional; generated if omitted
}
```

**Response (200 OK)**:
```json
{
  "requestId": "req_xyz789",
  "sessionId": "device_abc123_session_001",
  "response": {
    "text": "Here's how to implement JWT...",
    "provider": "deepseek",
    "metadata": {
      "latencyMs": 1250,
      "modelUsed": "deepseek-chat",
      "tokensUsed": 450
    }
  },
  "routing": {
    "capability": "DEVELOPMENT",
    "selectedProvider": "deepseek"
  },
  "timestamp": "2026-08-19T15:30:00Z"
}
```

**Response (500 Error)**:
```json
{
  "error": {
    "code": "PROVIDER_ERROR",
    "message": "DeepSeek API returned 429: Rate limit exceeded",
    "requestId": "req_xyz789",
    "timestamp": "2026-08-19T15:30:02Z"
  }
}
```

### 6.2 GET /api/v1/health

**Purpose**: Check backend status and provider availability.

**Response (200 OK)**:
```json
{
  "status": "ok",
  "providers": {
    "deepseek": { "status": "ok", "configured": true },
    "perplexity": { "status": "ok", "configured": true }
  },
  "timestamp": "2026-08-19T15:30:00Z"
}
```

### 6.3 POST /api/v1/requests (Async Future)

**Note**: Currently synchronous. When async is added (Phase 2+), response will include a `resultUrl` or use WebSocket.

```json
// Future: Asynchronous response structure
{
  "requestId": "req_xyz789",
  "status": "queued",
  "resultUrl": "/api/v1/results/req_xyz789",
  "pollingInterval": 2000
}

// Client polls GET /api/v1/results/req_xyz789 until status = "complete"
```

---

## 7. REQUEST CLASSIFICATION FLOW

```
User Text Input
    │
    ▼
┌─────────────────────────────────────────┐
│ KeywordClassifier                       │
│ (Replaceable strategy)                  │
│                                         │
│ Input: "How do I code JWT?"             │
│ Output: Capability.DEVELOPMENT          │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ CapabilityRouter                        │
│ (Hardcoded mapping)                     │
│                                         │
│ DEVELOPMENT → "deepseek"                │
│ RESEARCH    → "perplexity"              │
│ GENERAL     → "deepseek" (default)      │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ ProviderRegistry                        │
│ (Resolve adapter instance)              │
│                                         │
│ "deepseek" → DeepSeekAdapter instance   │
└─────────────────────────────────────────┘
    │
    ▼
Provider Adapter Executes
```

---

## 8. CAM ORCHESTRATOR (Core Logic)

```typescript
// src/orchestration/cam-orchestrator.ts
class CAMOrchestrator {
  constructor(
    private classifier: ClassificationStrategy,
    private router: CapabilityRouter,
    private registry: ProviderRegistry
  ) {}

  async processRequest(request: UserRequest): Promise<CAMResponse> {
    // Step 1: Classify
    const capability = this.classifier.classify(request);

    // Step 2: Route
    const providerName = this.router.route(capability);

    // Step 3: Get adapter
    const adapter = this.registry.get(providerName);

    // Step 4: Execute (synchronous wait)
    const providerResponse = await adapter.call(request);

    // Step 5: Synthesize (minimal in MVP)
    return {
      requestId: request.id,
      sessionId: request.sessionId,
      response: providerResponse,
      routing: {
        capability,
        selectedProvider: providerName,
      },
      timestamp: new Date(),
    };
  }
}

interface CAMResponse {
  requestId: string;
  sessionId: string;
  response: ProviderResponse;
  routing: {
    capability: Capability;
    selectedProvider: string;
  };
  timestamp: Date;
}
```

---

## 9. EXPRESS API LAYER (Minimal)

```typescript
// src/app.ts
import express from "express";
import { CAMOrchestrator } from "./orchestration/cam-orchestrator";
import { KeywordClassifier } from "./orchestration/classifiers/keyword-classifier";
import { CapabilityRouter } from "./orchestration/router";
import { ProviderRegistry } from "./providers/registry";
import { DeepSeekAdapter } from "./providers/deepseek/adapter";
import { PerplexityAdapter } from "./providers/perplexity/adapter";

const app = express();
app.use(express.json());

// Bootstrap
const registry = new ProviderRegistry();
registry.register("deepseek", new DeepSeekAdapter());
registry.register("perplexity", new PerplexityAdapter());

const classifier = new KeywordClassifier();
const router = new CapabilityRouter();
const cam = new CAMOrchestrator(classifier, router, registry);

// Routes
app.post("/api/v1/requests", async (req, res) => {
  try {
    const { text, sessionId } = req.body;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Invalid request: text required" });
    }

    const request: UserRequest = {
      id: generateRequestId(),
      text,
      sessionId: sessionId || generateSessionId(),
      timestamp: new Date(),
    };

    const response = await cam.processRequest(request);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      error: {
        code: "PROVIDER_ERROR",
        message: error.message,
        timestamp: new Date(),
      },
    });
  }
});

app.get("/api/v1/health", async (req, res) => {
  const providers = registry.list();
  const health = {
    status: "ok",
    providers: Object.fromEntries(
      providers.map(p => [p, { status: "ok", configured: true }])
    ),
    timestamp: new Date(),
  };
  return res.json(health);
});

export default app;
```

---

## 10. MOBILE UI APPROACH (LIGHTWEIGHT)

### 10.1 UI Framework Options

**Primary (MVP)**:
- HTML + Vanilla JS (single-page app, ~3KB gzipped)
- Connect to backend via fetch() API

**Why not React/Vue yet?**:
- Adds 40KB+ overhead
- Not needed for MVP proof
- Can migrate later without backend changes

### 10.2 HTML Structure

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CAM - Contextual AI Manager</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 20px auto; }
    input { width: 100%; padding: 10px; }
    button { padding: 10px 20px; cursor: pointer; }
    .result { margin-top: 20px; padding: 10px; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <h1>CAM Request</h1>
  <input id="userInput" type="text" placeholder="Ask something...">
  <button onclick="submitRequest()">Send</button>
  <div id="result"></div>

  <script src="client.js"></script>
</body>
</html>
```

### 10.3 Client Logic

```javascript
// public/client.js
async function submitRequest() {
  const text = document.getElementById("userInput").value;
  const sessionId = localStorage.getItem("sessionId") || generateSessionId();
  localStorage.setItem("sessionId", sessionId);

  const response = await fetch("/api/v1/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sessionId }),
  });

  const data = await response.json();
  displayResult(data);
}

function displayResult(data) {
  const resultDiv = document.getElementById("result");
  if (data.error) {
    resultDiv.innerHTML = `<p style="color:red">${data.error.message}</p>`;
  } else {
    resultDiv.innerHTML = `
      <p><strong>Provider:</strong> ${data.routing.selectedProvider}</p>
      <p><strong>Capability:</strong> ${data.routing.capability}</p>
      <p><strong>Response:</strong></p>
      <p>${data.response.text}</p>
      <p><em>Latency: ${data.response.metadata.latencyMs}ms</em></p>
    `;
  }
}

function generateSessionId() {
  return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

### 10.4 Mobile Adaptation (Later)

When building mobile apps (iOS/Android), use the same `/api/v1/requests` endpoint.

No backend changes needed. Just swap UI layer.

---

## 11. PROJECT FILE STRUCTURE (PHASE 1)

```
My-ai-CAM/
├── README.md                          # ← Existing
├── IMPLEMENTATION_PLAN_PHASE_1.md     # ← This file
├── .env.example                       # Environment template
├── .gitignore
├── package.json                       # Dependencies: express, typescript, jest
├── tsconfig.json
├── jest.config.js
│
├── src/
│   ├── index.ts                       # Entry point (start server)
│   ├── app.ts                         # Express app setup + routes
│   │
│   ├── types/
│   │   └── index.ts                   # All TypeScript interfaces
│   │       - UserRequest
│   │       - ProviderResponse
│   │       - CAMResponse
│   │       - Capability enum
│   │       - ClassificationStrategy
│   │       - ProviderAdapter
│   │
│   ├── orchestration/
│   │   ├── cam-orchestrator.ts        # Core: classify → route → execute → synthesize
│   │   ├── router.ts                  # CapabilityRouter (map capability → provider)
│   │   └── classifiers/
│   │       ├── strategy.ts            # ClassificationStrategy interface
│   │       └── keyword-classifier.ts  # KeywordClassifier implementation
│   │
│   ├── providers/
│   │   ├── adapter.ts                 # ProviderAdapter interface
│   │   ├── registry.ts                # ProviderRegistry (dependency injection)
│   │   ├── deepseek/
│   │   │   ├── adapter.ts             # DeepSeekAdapter
│   │   │   └── config.ts              # Configuration constants
│   │   ├── perplexity/
│   │   │   ├── adapter.ts             # PerplexityAdapter
│   │   │   └── config.ts
│   │   ├── gemini/                    # STUB - not implemented
│   │   │   └── adapter.ts             # Placeholder, throws "not implemented"
│   │   └── kimi/                      # STUB - not implemented
│   │       └── adapter.ts
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── requests.ts            # POST /requests, GET /requests/:id (future)
│   │   │   └── health.ts              # GET /health
│   │   ├── middleware/
│   │   │   ├── validation.ts          # Request validation
│   │   │   └── error-handler.ts       # Global error handler
│   │   └── validators/
│   │       └── schemas.ts             # Zod/simple validators
│   │
│   └── utils/
│       ├── logger.ts                  # Simple console logger
│       └── errors.ts                  # Custom error classes
│
├── public/
│   ├── index.html                     # Lightweight frontend (vanilla JS)
│   └── client.js                      # Client-side fetch logic
│
├── tests/
│   ├── unit/
│   │   ├── orchestration/
│   │   │   ├── cam-orchestrator.test.ts
│   │   │   ├── router.test.ts
│   │   │   └── keyword-classifier.test.ts
│   │   └── providers/
│   │       ├── deepseek.test.ts       # Mocked provider tests
│   │       └── perplexity.test.ts
│   │
│   ├── integration/
│   │   ├── end-to-end.test.ts         # Full request → response flow
│   │   └── providers.test.ts          # Optional: real provider calls (marked as slow)
│   │
│   └── fixtures/
│       ├── mock-responses.ts
│       └── test-requests.ts
│
├── docs/
│   ├── API.md                         # API endpoint documentation
│   └── ARCHITECTURE.md                # Architecture overview
│
├── .github/workflows/
│   ├── test.yml                       # CI: run tests on push
│   └── deploy.yml                     # CD: deploy to server (simple)
│
├── scripts/
│   ├── setup.sh                       # Install deps, setup env
│   ├── start.sh                       # Start server
│   └── test.sh                        # Run tests
│
└── .dockerignore, .gitignore, LICENSE
```

**Total Files to Create**: ~25 files
**Total Lines of Code (est.)**: ~2,000-2,500 (excluding tests)

---

## 12. TECHNOLOGY STACK (DETAILED)

### 12.1 Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.1",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.11",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "@supertest/supertest": "^6.3.3"
  }
}
```

### 12.2 Why Minimal?

- **No ORM**: Session/memory stored in-memory (request) only
- **No Redis**: No caching needed for MVP sync model
- **No Database**: No persistent state yet
- **No Bull**: No background jobs
- **No Telemetry**: Simple logging only
- **No Auth**: Device session ID only

---

## 13. API RESPONSE CYCLE (Complete)

```
MOBILE CLIENT
    │
    ├─ POST /api/v1/requests
    │  { "text": "How to code JWT?", "sessionId": "device_abc_123" }
    │
    ▼ (Express receives)
VALIDATION MIDDLEWARE
    ├─ Check text is non-empty
    ├─ Generate requestId (unique)
    │
    ▼
CAM ORCHESTRATOR
    ├─ Step 1: classifier.classify(text) → Capability.DEVELOPMENT
    ├─ Step 2: router.route(capability) → "deepseek"
    ├─ Step 3: registry.get("deepseek") → DeepSeekAdapter
    ├─ Step 4: adapter.call(request) → fetch() to DeepSeek API
    │          (blocks until response)
    │
    ▼
DEEPSEEK API
    ├─ Receive: { model, messages, max_tokens }
    ├─ Process: ~2 seconds
    │
    ▼
DEEPSEEK ADAPTER
    ├─ Parse response JSON
    ├─ Extract: text, token count, latency
    ├─ Return: ProviderResponse { provider, text, metadata }
    │
    ▼
CAM ORCHESTRATOR
    ├─ Step 5: Synthesize (wrap response + routing metadata)
    ├─ Return: CAMResponse
    │
    ▼
EXPRESS ROUTE HANDLER
    ├─ Serialize: CAMResponse → JSON
    ├─ Return: 200 OK
    │
    ▼
MOBILE CLIENT
    ├─ Receive JSON response
    ├─ Parse: response.text, provider, latency
    ├─ Render on screen
```

**Total Time**: 2-3 seconds (mostly provider latency)

---

## 14. TESTING STRATEGY (MINIMAL)

### 14.1 Unit Tests (Required for MVP)

**Test 1: KeywordClassifier**
```typescript
test("classifies 'code' + 'JWT' as DEVELOPMENT", () => {
  const classifier = new KeywordClassifier();
  const result = classifier.classify({ text: "How do I code JWT?" });
  expect(result).toBe(Capability.DEVELOPMENT);
});

test("classifies 'research' as RESEARCH", () => {
  const classifier = new KeywordClassifier();
  const result = classifier.classify({ text: "Research the latest AI news" });
  expect(result).toBe(Capability.RESEARCH);
});
```

**Test 2: CapabilityRouter**
```typescript
test("routes DEVELOPMENT to deepseek", () => {
  const router = new CapabilityRouter();
  expect(router.route(Capability.DEVELOPMENT)).toBe("deepseek");
});

test("routes RESEARCH to perplexity", () => {
  const router = new CapabilityRouter();
  expect(router.route(Capability.RESEARCH)).toBe("perplexity");
});
```

**Test 3: Provider Adapter Interface**
```typescript
test("DeepSeekAdapter implements ProviderAdapter", () => {
  const adapter = new DeepSeekAdapter();
  expect(adapter).toHaveProperty("call");
  expect(adapter).toHaveProperty("validate");
  expect(adapter).toHaveProperty("metadata");
});
```

### 14.2 Integration Tests (Required for MVP)

**Test: Full Request → Response**
```typescript
test("end-to-end: request → classify → route → execute → response", async () => {
  // Mock DeepSeek
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: "JWT is..." } }],
        usage: { total_tokens: 100 },
      }),
    })
  );

  const cam = new CAMOrchestrator(
    new KeywordClassifier(),
    new CapabilityRouter(),
    registry
  );

  const response = await cam.processRequest({
    id: "req_123",
    text: "How do I implement JWT?",
    sessionId: "sess_123",
    timestamp: new Date(),
  });

  expect(response.response.provider).toBe("deepseek");
  expect(response.response.text).toContain("JWT");
  expect(response.routing.capability).toBe(Capability.DEVELOPMENT);
});
```

### 14.3 API Tests (Optional for MVP, but recommended)

```typescript
test("POST /api/v1/requests returns 200", async () => {
  const response = await request(app)
    .post("/api/v1/requests")
    .send({ text: "test", sessionId: "test" });

  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty("requestId");
  expect(response.body).toHaveProperty("response");
});
```

### 14.4 Provider Mock Strategy

**Do NOT call real APIs in tests** (except optional slow test suite).

```typescript
// tests/fixtures/mock-responses.ts
export const DEEPSEEK_MOCK_RESPONSE = {
  ok: true,
  json: () => Promise.resolve({
    choices: [{ message: { content: "Mocked DeepSeek response" } }],
    usage: { total_tokens: 100 },
  }),
};

// In test file:
global.fetch = jest.fn(() => Promise.resolve(DEEPSEEK_MOCK_RESPONSE));
```

---

## 15. WHAT IS EXPLICITLY DEFERRED (PHASE 2+)

| Feature | Phase | Reason |
|---------|-------|--------|
| PostgreSQL Project Memory | Phase 2+ | Not needed to prove routing |
| Redis Caching | Phase 2+ | MVP synchronous only |
| Document Upload | Phase 2+ | No file handling in MVP |
| Kimi Adapter | Phase 2+ | Document analysis not MVP priority |
| Gemini Adapter | Phase 2+ | Not required by README |
| Meta/LLaMA Adapter | Phase 2+ | Not required |
| Async Job Queue (Bull) | Phase 2+ | MVP synchronous only |
| WebSocket Streaming | Phase 2+ | Not needed for sync MVP |
| JWT Authentication | Phase 2+ | Device ID sufficient for MVP |
| Admin Dashboard | Phase 2+ | Not needed to prove core logic |
| Advanced Telemetry | Phase 2+ | Basic logging sufficient |
| Request History Persistence | Phase 2+ | In-memory only, survives single session |
| Multi-AI Synthesis | Phase 2+ | Only one provider per request in MVP |
| PII Detection | Phase 2+ | No sensitive data handling in MVP |
| Rate Limiting (DB-backed) | Phase 2+ | In-memory counter only |
| Mobile Apps (native) | Phase 3+ | Lightweight web UI first |

---

## 16. DEPLOYMENT (MVP)

### 16.1 Local Development

```bash
# Install
npm install

# Setup env
cp .env.example .env
# Edit .env with API keys

# Start
npm start
# Server on http://localhost:3000
```

### 16.2 Production (Simple)

**Option A: Heroku/Railway (Easiest)**
```bash
# Deploy from GitHub
git push origin main
# CI/CD deploys automatically
```

**Option B: Docker**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src ./src
COPY public ./public
CMD ["npm", "start"]
```

**Option C: VPS (DigitalOcean, Linode)**
```bash
# SSH into VPS
ssh root@vps

# Clone repo
git clone https://github.com/mrvishwa929-web/My-ai-CAM.git
cd My-ai-CAM

# Setup
npm install
cp .env.production .env

# Start with PM2
npm install -g pm2
pm2 start src/index.ts --name cam
pm2 save
```

---

## 17. TESTING CHECKLIST (BEFORE LAUNCH)

- [ ] KeywordClassifier correctly categorizes 10+ sample requests
- [ ] CapabilityRouter maps all capabilities to providers
- [ ] DeepSeakAdapter handles valid responses
- [ ] DeepSeekAdapter handles errors (401, 429, timeout)
- [ ] PerplexityAdapter handles valid responses
- [ ] PerplexityAdapter handles errors
- [ ] CAMOrchestrator completes end-to-end flow
- [ ] POST /api/v1/requests returns valid response
- [ ] GET /api/v1/health returns provider status
- [ ] Web UI renders and submits requests
- [ ] Web UI displays responses correctly
- [ ] Error messages are clear and actionable
- [ ] Missing env vars throw helpful errors
- [ ] Provider adapters validate config on startup

---

## 18. SUCCESS CRITERIA (PHASE 1)

✅ User submits text request via mobile UI or API
✅ CAM classifies capability (DEVELOPMENT / RESEARCH / GENERAL)
✅ CAM routes to correct provider (DeepSeek or Perplexity)
✅ Provider adapter executes API call
✅ Response returned to user with provider attribution
✅ Latency < 5 seconds (99% of requests)
✅ No external dependencies (no DB, no Redis, no queue)
✅ Architecture supports adding new providers without core changes
✅ Routing strategy swappable (can replace KeywordClassifier later)
✅ Mobile-compatible API contract defined
✅ All unit + integration tests passing

---

## 19. TIMELINE (PHASE 1)

| Milestone | Duration | Days |
|-----------|----------|------|
| Core Orchestration (CAM + Routing) | 2 days | 1-2 |
| Provider Adapters (DeepSeek + Perplexity) | 2 days | 3-4 |
| Express API + Routes | 1 day | 5 |
| Mobile UI (HTML + Vanilla JS) | 1 day | 6 |
| Testing Suite | 2 days | 7-8 |
| Deployment + Documentation | 1 day | 9 |
| **Total** | **9 days** | — |

(1 developer, full-time)

---

## 20. SUMMARY

### What Phase 1 Proves
1. ✅ CAM can classify requests by capability (keyword-based MVP)
2. ✅ CAM can route to correct provider
3. ✅ Provider adapters work (2 implemented, others stubbed)
4. ✅ End-to-end request → response flows
5. ✅ Mobile API contract is sound
6. ✅ Architecture extensible for new providers
7. ✅ Routing strategy replaceable

### What Phase 1 Does NOT Include
1. ❌ Database persistence
2. ❌ Document uploads/analysis
3. ❌ Kimi or any complex orchestration
4. ❌ JWT/advanced authentication
5. ❌ Async job queues
6. ❌ WebSocket streaming
7. ❌ Admin dashboards
8. ❌ Native mobile apps

### How Phase 1 Enables Future Phases
- **Phase 2**: Add database → persistent sessions + conversation history
- **Phase 3**: Add document upload → enable Kimi activation
- **Phase 4**: Add async queue → enable parallel provider execution + synthesis
- **Phase 5**: Add more providers (Gemini, Meta, etc.)
- **Phase 6**: Add mobile apps, advanced features, scale

---

## APPROVAL GATE

This revised implementation plan:

✅ Respects "minimal MVP" scope  
✅ Moves to mobile-first architecture  
✅ Removes all phase 2+ components  
✅ Uses simple session IDs (no JWT)  
✅ Supports pluggable routing strategy  
✅ Defers async/queue/database  
✅ Includes provider extension stubs  
✅ Defines clear API contract  
✅ Includes lightweight UI approach  
✅ Provides realistic 9-day timeline  

**Ready to begin Phase 1 implementation upon your approval.**

---

**Questions or modifications before code begins?**
