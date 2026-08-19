/**
 * CapabilityRouter Unit Tests
 */

import { CapabilityRouter } from '../../../src/orchestration/router.js';
import { Capability } from '../../../src/types/index.js';

describe('CapabilityRouter', () => {
  let router: CapabilityRouter;

  beforeEach(() => {
    router = new CapabilityRouter();
  });

  it('should route DEVELOPMENT to deepseek', () => {
    const provider = router.route(Capability.DEVELOPMENT);
    expect(provider).toBe('deepseek');
  });

  it('should route RESEARCH to perplexity', () => {
    const provider = router.route(Capability.RESEARCH);
    expect(provider).toBe('perplexity');
  });

  it('should route GENERAL to deepseek', () => {
    const provider = router.route(Capability.GENERAL);
    expect(provider).toBe('deepseek');
  });

  it('should list all available capabilities', () => {
    const capabilities = router.getAvailableCapabilities();
    expect(capabilities).toContain(Capability.DEVELOPMENT);
    expect(capabilities).toContain(Capability.RESEARCH);
    expect(capabilities).toContain(Capability.GENERAL);
  });
});
