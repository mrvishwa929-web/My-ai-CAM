/**
 * End-to-End Integration Tests
 */

import request from 'supertest';
import { app } from '../../src/app.js';

describe('CAM End-to-End', () => {
  it('should handle a complete request cycle with mock provider', async () => {
    // Mock fetch to simulate provider response
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Test response' } }],
            usage: { total_tokens: 100 },
          }),
      } as any)
    );

    const response = await request(app)
      .post('/api/v1/requests')
      .send({
        text: 'How do I implement JWT?',
        sessionId: 'sess_test_123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('requestId');
    expect(response.body).toHaveProperty('sessionId');
    expect(response.body).toHaveProperty('response');
    expect(response.body).toHaveProperty('routing');
    expect(response.body.routing).toHaveProperty('capability');
    expect(response.body.routing).toHaveProperty('selectedProvider');
    expect(response.body.response).toHaveProperty('text');
    expect(response.body.response).toHaveProperty('provider');
    expect(response.body.response).toHaveProperty('metadata');
  });

  it('should return 400 for invalid request', async () => {
    const response = await request(app)
      .post('/api/v1/requests')
      .send({ text: '' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });

  it('should return health status', async () => {
    const response = await request(app)
      .get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('providers');
  });

  it('should serve the mobile UI', async () => {
    const response = await request(app)
      .get('/');

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/text\/html/);
    expect(response.text).toContain('CAM');
    expect(response.text).toContain('Contextual AI Manager');
  });
});
