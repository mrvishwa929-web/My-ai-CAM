/**
 * Keyword-based classifier
 * Maps user request text to capability category
 * Strategy is replaceable - just implement ClassificationStrategy interface
 */

import { ClassificationStrategy, Capability, UserRequest } from '../../types/index.js';

export class KeywordClassifier implements ClassificationStrategy {
  private developmentKeywords = [
    'code', 'implement', 'debug', 'function', 'class', 'api',
    'algorithm', 'refactor', 'optimize', 'architecture', 'framework',
    'library', 'package', 'module', 'test', 'deploy', 'build',
    'error', 'bug', 'fix', 'feature', 'method', 'variable'
  ];

  private researchKeywords = [
    'research', 'find', 'current', 'latest', 'news', 'search',
    'what is', 'how do i find', 'where can i', 'information',
    'data', 'statistics', 'trends', 'web', 'internet', 'online',
    'discover', 'explore', 'look up', 'compare', 'review'
  ];

  classify(request: UserRequest): Capability {
    const text = request.text.toLowerCase();

    // Check DEVELOPMENT keywords
    if (this.containsAny(text, this.developmentKeywords)) {
      return Capability.DEVELOPMENT;
    }

    // Check RESEARCH keywords
    if (this.containsAny(text, this.researchKeywords)) {
      return Capability.RESEARCH;
    }

    // Default
    return Capability.GENERAL;
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  }
}
