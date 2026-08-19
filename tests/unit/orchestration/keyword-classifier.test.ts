/**
 * KeywordClassifier Unit Tests
 */

import { KeywordClassifier } from '../../../src/orchestration/classifiers/keyword-classifier.js';
import { Capability, UserRequest } from '../../../src/types/index.js';

describe('KeywordClassifier', () => {
  let classifier: KeywordClassifier;

  beforeEach(() => {
    classifier = new KeywordClassifier();
  });

  it('should classify development questions', () => {
    const developmentQuestions = [
      'How do I implement a function?',
      'Debug this code',
      'What is a JavaScript API?',
      'Build a REST API',
      'Optimize this algorithm',
    ];

    developmentQuestions.forEach(text => {
      const request: UserRequest = {
        id: 'test',
        text,
        sessionId: 'sess_test',
        timestamp: new Date(),
      };

      const result = classifier.classify(request);
      expect(result).toBe(Capability.DEVELOPMENT);
    });
  });

  it('should classify research questions', () => {
    const researchQuestions = [
      'Research the latest AI trends',
      'Find information about quantum computing',
      'What is the current state of blockchain?',
      'Search for renewable energy news',
      'Look up climate statistics',
    ];

    researchQuestions.forEach(text => {
      const request: UserRequest = {
        id: 'test',
        text,
        sessionId: 'sess_test',
        timestamp: new Date(),
      };

      const result = classifier.classify(request);
      expect(result).toBe(Capability.RESEARCH);
    });
  });

  it('should default to general for ambiguous questions', () => {
    const generalQuestions = [
      'Tell me a joke',
      'What is life?',
      'Explain philosophy',
      'How does weather work?',
    ];

    generalQuestions.forEach(text => {
      const request: UserRequest = {
        id: 'test',
        text,
        sessionId: 'sess_test',
        timestamp: new Date(),
      };

      const result = classifier.classify(request);
      expect(result).toBe(Capability.GENERAL);
    });
  });
});
