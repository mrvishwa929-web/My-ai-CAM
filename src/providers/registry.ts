/**
 * Provider Registry
 * Dependency injection container for provider adapters
 */

import { ProviderAdapter } from '../types/index.js';
import { Logger } from '../utils/logger.js';

export class ProviderRegistry {
  private providers: Map<string, ProviderAdapter> = new Map();

  register(name: string, adapter: ProviderAdapter): void {
    this.providers.set(name, adapter);
    Logger.info(`Provider registered: ${name}`);
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

  async validateAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, adapter] of this.providers) {
      try {
        await adapter.validate();
        results.set(name, true);
        Logger.info(`Provider validation passed: ${name}`);
      } catch (error) {
        results.set(name, false);
        Logger.error(`Provider validation failed: ${name}`, error);
      }
    }

    return results;
  }
}
