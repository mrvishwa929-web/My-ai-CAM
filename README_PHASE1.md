# CAM Phase 1 - Minimal MVP Implementation

## Overview

CAM (Contextual AI Manager) is a mobile-first orchestration system that routes user requests to appropriate AI providers based on request classification.

**Phase 1 proves**: Request → Classify → Route → Execute → Synthesize → Response

## Architecture

```
Mobile Client (HTML/JS)
    ↓
  API: POST /api/v1/requests
    ↓
  CAM Orchestrator
    ├─ Classify (KeywordClassifier)
    ├─ Route (CapabilityRouter)
    ├─ Execute (Provider Adapter)
    └─ Synthesize (Wrap response + metadata)
    ↓
  Providers: DeepSeek | Perplexity
    ↓
  Response JSON
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your API keys:
# - DEEPSEEK_API_KEY
# - PERPLEXITY_API_KEY
```

### 3. Start the Server
```bash
npm start
```

Server runs on `http://localhost:3000`

### 4. Open Mobile UI
Go to `http://localhost:3000` in your browser

## API Endpoints

### POST /api/v1/requests
Submit a user request

**Request**:
```json
{
  "text": "How do I implement JWT authentication?",
  "sessionId": "optional_session_id"
}
```

**Response** (200 OK):
```json
{
  "requestId": "req_123456789",
  "sessionId": "sess_123456789",
  "response": {
    "provider": "deepseek",
    "text": "JWT authentication is...",
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

### GET /api/v1/health
Check provider status

**Response** (200 OK):
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

## Classification Logic

Requests are classified into capabilities:

| Capability | Keywords | Provider |
|------------|----------|----------|
| **DEVELOPMENT** | code, implement, debug, function, API, algorithm, test, deploy | DeepSeek |
| **RESEARCH** | research, find, latest, news, search, trends, discover | Perplexity |
| **GENERAL** | (default) | DeepSeek |

## Testing

### Run All Tests
```bash
npm test
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Run Unit Tests Only
```bash
npm test -- tests/unit
```

### Run Integration Tests Only
```bash
npm test -- tests/integration
```

## Project Structure

```
src/
├── index.ts                              # Entry point
├── app.ts                                # Express server + routes
├── types/
│   └── index.ts                          # All TypeScript interfaces
├── orchestration/
│   ├── cam-orchestrator.ts               # Core: classify → route → execute
│   ├── router.ts                         # Capability → Provider mapping
│   └── classifiers/
│       └── keyword-classifier.ts         # MVP classifier
├── providers/
│   ├── registry.ts                       # Provider dependency injection
│   ├── deepseek/
│   │   └── adapter.ts                    # DeepSeek API integration
│   └── perplexity/
│       └── adapter.ts                    # Perplexity API integration
└── utils/
    ├── logger.ts                         # Simple logging
    └── id-generator.ts                   # Request/session ID generation

tests/
├── unit/
│   └── orchestration/                    # CAM component tests
└── integration/
    └── end-to-end.test.ts                # Full request cycle tests
```

## What's NOT in Phase 1

- ❌ Database persistence
- ❌ Kimi adapter (complex document analysis)
- ❌ Async job queue (synchronous only)
- ❌ WebSocket streaming
- ❌ JWT authentication (session ID only)
- ❌ Admin dashboard
- ❌ Native mobile apps

## Phase 2+ Roadmap

- **Phase 2**: Add database → session history + conversation memory
- **Phase 3**: Add document upload → Kimi adapter for complex analysis
- **Phase 4**: Add async queue → parallel provider execution + synthesis
- **Phase 5**: Add Gemini, Meta, Qwen adapters
- **Phase 6**: Native mobile apps, advanced features, scale

## Example Usage

### Test Development Classification
```bash
curl -X POST http://localhost:3000/api/v1/requests \
  -H "Content-Type: application/json" \
  -d '{"text": "How do I implement JWT in Node.js?"}'
```

Expected routing:
- Capability: DEVELOPMENT
- Provider: DeepSeek

### Test Research Classification
```bash
curl -X POST http://localhost:3000/api/v1/requests \
  -H "Content-Type: application/json" \
  -d '{"text": "What are the latest AI trends in 2024?"}'
```

Expected routing:
- Capability: RESEARCH
- Provider: Perplexity

## Troubleshooting

### Provider Not Configured
**Error**: `DEEPSEEK_API_KEY not configured or invalid`

**Solution**: Check `.env` file has valid API keys
```bash
echo $DEEPSEEK_API_KEY
```

### Provider Timeout
**Error**: `DeepSeek call failed after 30000ms`

**Solution**: Increase `CAM_TIMEOUT_MS` in `.env` or check network/provider status

### Empty Response
**Error**: `Provider returned empty response`

**Solution**: Verify provider API key is valid and provider is operational

## Development

### Watch Mode
```bash
npm run dev
```

### View Logs
Logs are printed to console. Set `NODE_ENV=development` for debug logs.

## Deployment

### Heroku/Railway
```bash
git push origin main  # Auto-deploys if CI passes
```

### Docker
```bash
docker build -t cam .
docker run -e DEEPSEEK_API_KEY=... -e PERPLEXITY_API_KEY=... -p 3000:3000 cam
```

### VPS
```bash
clone repo → npm install → npm start (with PM2)
```

## Success Metrics

✅ Request → Response latency < 5 seconds
✅ Correct capability classification
✅ Correct provider routing
✅ All unit tests passing
✅ All integration tests passing
✅ Mobile UI responsive and functional

---

**Phase 1 MVP Status**: ✅ Complete

Ready for Phase 2 when: Database requirements become clear
