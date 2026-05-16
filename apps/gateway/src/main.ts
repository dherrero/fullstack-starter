import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';

import api from './routes';

const parseOrigins = (raw?: string): string[] =>
  (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

class Main {
  #app: express.Application;
  #port: number;

  constructor(port: number) {
    this.#app = express();
    this.#port = port;
  }

  start() {
    this.#config();
    this.#setRoutes();
    this.#app.listen(this.#port, '0.0.0.0', () => {
      console.log(`🚀 Gateway listening on port ${this.#port}`);
    });
  }

  #config() {
    this.#app.set('trust proxy', 1);

    const corsOptions: cors.CorsOptions = {
      origin: parseOrigins(process.env.CORS_ORIGIN) ?? true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Authorization'],
    };
    this.#app.use(cors(corsOptions));
    this.#app.use(cookieParser());
    this.#app.use(express.json());
  }

  #setRoutes() {
    this.#app.use('/api', api);
  }
}

const PORT = process.env.GATEWAY_PORT ? Number(process.env.GATEWAY_PORT) : 3100;
new Main(PORT).start();
