/**
 * CAM Orchestrator
 * Core loop: Classify → Route → Execute → Synthesize
 */

import {
  UserRequest,
  CAMResponse,
  ClassificationStrategy,
  Capability,
} from '../types/index.js';
import { CapabilityRouter } from './router.js';
import { ProviderRegistry } from '../providers/registry.js';
import { Logger } from '../utils/logger.js';

export class CAMOrchestrator {
  constructor(
    private classifier: ClassificationStrategy,
    private router: CapabilityRouter,
    private registry: ProviderRegistry
  ) {}

  async processRequest(request: UserRequest): Promise<CAMResponse> {
    Logger.debug('CAM: Starting orchestration', { requestId: request.id });

    // Step 1: Classify
    const capability = this.classifier.classify(request);
    Logger.debug('CAM: Classification', { capability, requestId: request.id });

    // Step 2: Route
    const providerName = this.router.route(capability);
    Logger.debug('CAM: Routing', { provider: providerName, requestId: request.id });

    // Step 3: Get adapter
    const adapter = this.registry.get(providerName);
    Logger.debug('CAM: Provider resolved', { provider: providerName });

    // Step 4: Execute
    Logger.debug('CAM: Executing provider', { provider: providerName });
    const providerResponse = await adapter.call(request);

    // Step 5: Synthesize
    const response: CAMResponse = {
      requestId: request.id,
      sessionId: request.sessionId,
      response: providerResponse,
      routing: {
        capability,
        selectedProvider: providerName,
      },
      timestamp: new Date(),
    };

    Logger.debug('CAM: Orchestration complete', { requestId: request.id });
    return response;
  }
}
