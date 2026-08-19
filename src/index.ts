/**
 * CAM - Contextual AI Manager
 * Entry point for the application
 */

import dotenv from 'dotenv';
import { app, registry } from './app.js';
import { Logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startup() {
  try {
    Logger.info('CAM starting up...');

    // Validate provider configuration
    Logger.info('Validating provider configuration...');
    const validationResults = await registry.validateAll();

    const validProviders = Array.from(validationResults.entries())
      .filter(([_, valid]) => valid)
      .map(([name, _]) => name);

    if (validProviders.length === 0) {
      throw new Error('No valid providers configured. Please check your environment variables.');
    }

    Logger.info(`Valid providers: ${validProviders.join(', ')}`);

    // Start server
    app.listen(PORT, () => {
      Logger.info(`CAM listening on http://localhost:${PORT}`);
      Logger.info('Mobile UI available at http://localhost:' + PORT);
      Logger.info('API: POST http://localhost:' + PORT + '/api/v1/requests');
      Logger.info('Health: GET http://localhost:' + PORT + '/api/v1/health');
    });
  } catch (error) {
    Logger.error('Startup failed', error);
    process.exit(1);
  }
}

startup();
