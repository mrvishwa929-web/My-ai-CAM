/**
 * Perplexity Provider Adapter
 * Implements ProviderAdapter interface for Perplexity API
 */

import {
  ProviderAdapter,
  ProviderMetadata,
  ProviderResponse,
  UserRequest,
  Capability,
} from '../../types/index.js';
import { Logger } from '../../utils/logger.js';

export class PerplexityAdapter implements ProviderAdapter {
  private apiKey: string;
  private model: string;
  private timeoutMs: number;

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    this.model = process.env.PERPLEXITY_MODEL || 'pplx-7b-online';
    this.timeoutMs = parseInt(process.env.CAM_TIMEOUT_MS || '30000', 10);
  }

  async call(request: UserRequest): Promise<ProviderResponse> {
    const startTime = Date.now();
    Logger.debug('Perplexity: Calling API', { model: this.model });

    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: request.text,
            },
          ],
          max_tokens: 2000,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(`Perplexity API error: ${response.status}`, errorText);
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Perplexity returned empty response');
      }

      const latencyMs = Date.now() - startTime;
      Logger.debug('Perplexity: Response received', { latencyMs });

      return {
        provider: 'perplexity',
        text: content,
        metadata: {
          latencyMs,
          modelUsed: this.model,
          tokensUsed: data.usage?.total_tokens,
        },
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      Logger.error('Perplexity: Call failed', error);
      throw new Error(
        `Perplexity call failed after ${latencyMs}ms: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async validate(): Promise<void> {
    if (!this.apiKey || this.apiKey === '' || this.apiKey.startsWith('pplx_your')) {
      throw new Error('PERPLEXITY_API_KEY not configured or invalid');
    }
    Logger.info('Perplexity adapter validated');
  }

  metadata(): ProviderMetadata {
    return {
      name: 'perplexity',
      capabilities: [Capability.RESEARCH, Capability.GENERAL],
      version: '1.0',
      configRequired: ['PERPLEXITY_API_KEY'],
    };
  }
}
