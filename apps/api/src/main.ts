import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';

import { getConnectionStats, testConnection } from './adapters/db/pg.connector';
import { UPLOAD_DIR } from './globals';
import {
  dbErrorMiddleware,
  dbLoggingMiddleware,
  sequelizeErrorMiddleware,
} from './middleware';
import api from './routes';

class Main {
  #app: express.Application;
  #port: number;

  constructor(port: number) {
    this.#app = express();
    this.#port = port;
  }

  async start() {
    this.#config();
    this.#setRoutes();

    this.#app.listen(this.#port, '0.0.0.0', () => {
      console.log(`🚀 API service listening on port ${this.#port}`);
      console.log('⚠️ Database connection will be attempted in background');
    });

    this.#attemptDatabaseConnection();
  }

  async #attemptDatabaseConnection() {
    const ok = await testConnection();
    if (ok) {
      console.log('✅ Database connection established');
    } else {
      console.log('⚠️ Database connection failed, retries will continue');
    }
    this.#startHealthCheck();
  }

  #startHealthCheck() {
    setInterval(() => {
      const stats = getConnectionStats();
      if (!stats.isConnected) {
        console.log('⚠️ Database connection lost, reconnecting...');
        this.#attemptDatabaseConnection();
      }
    }, 30000);
  }

  #config() {
    /**
     * The API sits in the private docker network behind the gateway.
     * It never receives traffic directly from clients, so CORS lives
     * in the gateway and is intentionally omitted here.
     */
    this.#app.set('trust proxy', 1);
    // Defense-in-depth security headers even though the API is private (behind
    // the gateway). Returns JSON only, so the document CSP is left to the front.
    this.#app.use(helmet({ contentSecurityPolicy: false }));
    this.#app.use(express.json());
    this.#app.use(dbLoggingMiddleware);
    this.#app.use(dbErrorMiddleware);

    this.#app.use(
      process.env.NODE_UPLOAD_FILES
        ? `/${process.env.NODE_UPLOAD_FILES}`
        : '/uploads',
      express.static(UPLOAD_DIR),
    );
  }

  #setRoutes() {
    try {
      this.#app.use(api);
      this.#app.use(sequelizeErrorMiddleware);
    } catch (error) {
      console.error(error);
    }
  }
}

const PORT = process.env.NODE_PORT ? Number(process.env.NODE_PORT) : 3200;
const main = new Main(PORT);
main.start().catch((error) => {
  console.error('❌ Failed to start API service:', error);
  process.exit(1);
});
