import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';

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

    // Security headers (HSTS, X-Content-Type-Options, X-Frame-Options: DENY,
    // etc.). The document-level CSP is owned by the front's nginx; the gateway
    // only returns JSON, so a document CSP here would be noise.
    this.#app.use(helmet({ contentSecurityPolicy: false }));

    // Fail closed: with credentials:true, never fall back to reflecting any
    // origin (that would enable account takeover). An empty CORS_ORIGIN means
    // "no cross-origin allowed", and we log it loudly as a misconfiguration.
    const allowedOrigins = parseOrigins(process.env.CORS_ORIGIN);
    if (allowedOrigins.length === 0) {
      console.error(
        '⚠️ CORS_ORIGIN is empty — all cross-origin requests will be rejected. Set it in your env.',
      );
    }
    const corsOptions: cors.CorsOptions = {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Authorization'],
    };
    this.#app.use(cors(corsOptions));
    this.#app.use(cookieParser());

    // Parse JSON only where a body is actually consumed (the auth endpoints),
    // with an explicit small size limit. Proxied API traffic is streamed, never
    // buffered/parsed here.
    const jsonParser = express.json({ limit: '100kb' });
    this.#app.use((req, res, next) => {
      if (req.path.startsWith('/api/v1/auth')) {
        return jsonParser(req, res, next);
      }
      return next();
    });
  }

  #setRoutes() {
    this.#app.use('/api', api);
  }
}

const PORT = process.env.GATEWAY_PORT ? Number(process.env.GATEWAY_PORT) : 3100;
new Main(PORT).start();
