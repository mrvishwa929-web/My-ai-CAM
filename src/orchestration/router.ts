/**
 * Capability Router
 * Maps Capability categories to provider names
 * Hardcoded for MVP (can be moved to config later)
 */

import { Capability } from '../types/index.js';

export class CapabilityRouter {
  private capabilityToProvider: Record<Capability, string> = {
    [Capability.DEVELOPMENT]: 'deepseek',
    [Capability.RESEARCH]: 'perplexity',
    [Capability.GENERAL]: 'deepseek',
  };

  route(capability: Capability): string {
    return this.capabilityToProvider[capability];
  }

  getAvailableCapabilities(): Capability[] {
    return Object.values(Capability);
  }
}
