/**
 * DeepSeek Provider Adapter
 * Implements ProviderAdapter interface for DeepSeek API
 */

import {
  ProviderAdapter,
  ProviderMetadata,
  ProviderResponse,
  UserRequest,
  Capability,
} from '../../types/index.js';
import { Logger } from '../../utils/logger.js';

export class DeepSeekAdapter implements ProviderAdapter {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    this.timeoutMs = parseInt(process.env.CAM_TIMEOUT_MS || '30000', 10);
  }

  async call(request: UserRequest): Promise<ProviderResponse> {
    const startTime = Date.now();
    Logger.debug('DeepSeek: Calling API', { model: this.model });

    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
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
        Logger.error(`DeepSeek API error: ${response.status}`, errorText);
        throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('DeepSeek returned empty response');
      }

      const latencyMs = Date.now() - startTime;
      Logger.debug('DeepSeek: Response received', { latencyMs });

      return {
        provider: 'deepseek',
        text: content,
        metadata: {
          latencyMs,
          modelUsed: this.model,
          tokensUsed: data.usage?.total_tokens,
        },
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      Logger.error('DeepSeek: Call failed', error);
      throw new Error(
        `DeepSeek call failed after ${latencyMs}ms: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async validate(): Promise<void> {
    if (!this.apiKey || this.apiKey === '' || this.apiKey.startsWith('sk_your')) {
      throw new Error('DEEPSEEK_API_KEY not configured or invalid');
    }
    Logger.info('DeepSeek adapter validated');
  }

  metadata(): ProviderMetadata {
    return {
      name: 'deepseek',
      capabilities: [Capability.DEVELOPMENT, Capability.GENERAL],
      version: '1.0',
      configRequired: ['DEEPSEEK_API_KEY'],
    };
  }
}
