/**
 * Express Application
 * Minimal mobile API server
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { CAMOrchestrator } from './orchestration/cam-orchestrator.js';
import { CapabilityRouter } from './orchestration/router.js';
import { KeywordClassifier } from './orchestration/classifiers/keyword-classifier.js';
import { ProviderRegistry } from './providers/registry.js';
import { DeepSeekAdapter } from './providers/deepseek/adapter.js';
import { PerplexityAdapter } from './providers/perplexity/adapter.js';
import { UserRequest } from './types/index.js';
import { generateRequestId, generateSessionId } from './utils/id-generator.js';
import { Logger } from './utils/logger.js';

const app: Express = express();

// Middleware
app.use(express.json());

// Bootstrap CAM
const registry = new ProviderRegistry();
registry.register('deepseek', new DeepSeekAdapter());
registry.register('perplexity', new PerplexityAdapter());

const classifier = new KeywordClassifier();
const router = new CapabilityRouter();
const cam = new CAMOrchestrator(classifier, router, registry);

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  Logger.error('Request error', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message,
      timestamp: new Date().toISOString(),
    },
  });
});

// Routes

/**
 * POST /api/v1/requests
 * Submit a user request and get a response
 */
app.post('/api/v1/requests', async (req: Request, res: Response) => {
  try {
    const { text, sessionId } = req.body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'text field is required and must be non-empty',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Create request object
    const userRequest: UserRequest = {
      id: generateRequestId(),
      text: text.trim(),
      sessionId: sessionId || generateSessionId(),
      timestamp: new Date(),
    };

    Logger.info('Request received', { requestId: userRequest.id, sessionId: userRequest.sessionId });

    // Process through CAM
    const response = await cam.processRequest(userRequest);

    Logger.info('Request completed', { requestId: userRequest.id, provider: response.routing.selectedProvider });

    return res.status(200).json(response);
  } catch (error) {
    Logger.error('Request processing failed', error);
    return res.status(500).json({
      error: {
        code: 'PROVIDER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/v1/health
 * Check backend status and provider availability
 */
app.get('/api/v1/health', async (req: Request, res: Response) => {
  try {
    const validationResults = await registry.validateAll();

    const providers: Record<string, { status: string; configured: boolean }> = {};
    for (const name of registry.list()) {
      const isValid = validationResults.get(name) ?? false;
      providers[name] = {
        status: isValid ? 'ok' : 'misconfigured',
        configured: isValid,
      };
    }

    return res.status(200).json({
      status: 'ok',
      providers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('Health check failed', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /
 * Serve lightweight mobile UI
 */
app.get('/', (req: Request, res: Response) => {
  res.type('text/html').send(getHTMLUI());
});

/**
 * GET /client.js
 * Serve client-side JavaScript
 */
app.get('/client.js', (req: Request, res: Response) => {
  res.type('text/javascript').send(getClientJS());
});

export { app, registry, cam };

/**
 * Lightweight HTML UI
 */
function getHTMLUI(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CAM - Contextual AI Manager</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      width: 100%;
      max-width: 600px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 30px;
    }
    h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: #333;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .form-group {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
    }
    input {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .result {
      margin-top: 30px;
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
      border-left: 4px solid #667eea;
      display: none;
    }
    .result.show {
      display: block;
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 10px;
    }
    .provider-badge {
      display: inline-block;
      padding: 4px 12px;
      background: #667eea;
      color: white;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .capability-badge {
      display: inline-block;
      padding: 4px 12px;
      background: #f0f0f0;
      color: #333;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }
    .result-text {
      line-height: 1.6;
      color: #333;
      margin-bottom: 15px;
      max-height: 300px;
      overflow-y: auto;
    }
    .result-meta {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #999;
    }
    .error {
      background: #fee;
      border-left-color: #f44;
      color: #c33;
    }
    .loading {
      text-align: center;
      color: #999;
      padding: 20px;
    }
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 10px;
      vertical-align: middle;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 CAM</h1>
    <p class="subtitle">Contextual AI Manager • Mobile-First Orchestration</p>

    <div class="form-group">
      <input
        id="userInput"
        type="text"
        placeholder="Ask something... (e.g., 'How do I implement JWT?' or 'What are the latest AI trends?')"
        autocomplete="off"
      />
      <button id="sendBtn" onclick="submitRequest()">Send</button>
    </div>

    <div id="result" class="result">
      <div class="result-header">
        <div>
          <span class="provider-badge" id="providerBadge"></span>
          <span class="capability-badge" id="capabilityBadge"></span>
        </div>
        <div style="font-size: 12px; color: #999;" id="latency"></div>
      </div>
      <div id="resultContent"></div>
    </div>
  </div>

  <script src="client.js"><\/script>
</body>
</html>`;
}

/**
 * Client-side JavaScript
 */
function getClientJS(): string {
  return `
(function() {
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const resultDiv = document.getElementById('result');
  const resultContent = document.getElementById('resultContent');
  const providerBadge = document.getElementById('providerBadge');
  const capabilityBadge = document.getElementById('capabilityBadge');
  const latency = document.getElementById('latency');

  let sessionId = localStorage.getItem('cam_sessionId');
  if (!sessionId) {
    sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('cam_sessionId', sessionId);
  }

  async function submitRequest() {
    const text = userInput.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    userInput.disabled = true;
    resultDiv.classList.remove('show', 'error');
    resultContent.innerHTML = '<div class="loading"><span class="spinner"></span>Processing...</div>';
    resultDiv.classList.add('show');

    try {
      const response = await fetch('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sessionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Request failed');
      }

      displayResult(data);
      userInput.value = '';
    } catch (error) {
      displayError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      sendBtn.disabled = false;
      userInput.disabled = false;
      userInput.focus();
    }
  }

  function displayResult(data) {
    resultDiv.classList.remove('error');
    resultDiv.classList.add('show');

    const provider = data.routing.selectedProvider;
    const capability = data.routing.capability;
    const responseLatency = data.response.metadata.latencyMs;

    providerBadge.textContent = provider.toUpperCase();
    capabilityBadge.textContent = capability;
    latency.textContent = responseLatency + 'ms';

    const responseText = data.response.text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .split('\\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('<br>');

    resultContent.innerHTML = '<div class="result-text">' + responseText + '</div><div class="result-meta"><span>Session: ' + sessionId + '</span></div>';
  }

  function displayError(message) {
    resultDiv.classList.add('error', 'show');
    resultContent.innerHTML = '<div class="result-text"><strong>Error:</strong> ' + message + '</div>';
  }

  window.submitRequest = submitRequest;

  // Allow Enter key to submit
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
      submitRequest();
    }
  });
})();
`;
}
