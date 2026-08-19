/**
 * CAM Orchestrator Unit Tests
 */

import { CAMOrchestrator } from '../../../src/orchestration/cam-orchestrator.js';
import { CapabilityRouter } from '../../../src/orchestration/router.js';
import { KeywordClassifier } from '../../../src/orchestration/classifiers/keyword-classifier.js';
import { ProviderRegistry } from '../../../src/providers/registry.js';
import { ProviderAdapter, ProviderResponse, UserRequest, Capability, ProviderMetadata } from '../../../src/types/index.js';

class MockAdapter implements ProviderAdapter {
  async call(request: UserRequest): Promise<ProviderResponse> {
    return {
      provider: 'mock',
      text: `Mock response to: ${request.text}`,
      metadata: {
        latencyMs: 100,
        modelUsed: 'mock-model',
      },
    };
  }

  async validate(): Promise<void> {
    // Mock is always valid
  }

  metadata(): ProviderMetadata {
    return {
      name: 'mock',
      capabilities: [Capability.GENERAL],
      version: '1.0',
      configRequired: [],
    };
  }
}

describe('CAMOrchestrator', () => {
  let cam: CAMOrchestrator;
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    registry.register('mock', new MockAdapter());

    const classifier = new KeywordClassifier();
    const router = new CapabilityRouter();
    cam = new CAMOrchestrator(classifier, router, registry);
  });

  it('should classify and route a development request', async () => {
    const request: UserRequest = {
      id: 'test_1',
      text: 'How do I implement a function in JavaScript?',
      sessionId: 'sess_test',
      timestamp: new Date(),
    };

    // Mock the router to return mock provider
    const routerSpy = jest.spyOn(CapabilityRouter.prototype, 'route').mockReturnValue('mock');

    const response = await cam.processRequest(request);

    expect(response.routing.selectedProvider).toBe('mock');
    expect(response.response.text).toContain('Mock response');
    expect(response.requestId).toBe('test_1');
    expect(response.routing.capability).toBe(Capability.DEVELOPMENT);

    routerSpy.mockRestore();
  });

  it('should classify and route a research request', async () => {
    const request: UserRequest = {
      id: 'test_2',
      text: 'What are the latest AI trends?',
      sessionId: 'sess_test',
      timestamp: new Date(),
    };

    const routerSpy = jest.spyOn(CapabilityRouter.prototype, 'route').mockReturnValue('mock');

    const response = await cam.processRequest(request);

    expect(response.routing.capability).toBe(Capability.RESEARCH);
    expect(response.response.text).toContain('Mock response');

    routerSpy.mockRestore();
  });

  it('should use general capability as default', async () => {
    const request: UserRequest = {
      id: 'test_3',
      text: 'Tell me a joke',
      sessionId: 'sess_test',
      timestamp: new Date(),
    };

    const routerSpy = jest.spyOn(CapabilityRouter.prototype, 'route').mockReturnValue('mock');

    const response = await cam.processRequest(request);

    expect(response.routing.capability).toBe(Capability.GENERAL);

    routerSpy.mockRestore();
  });
});
