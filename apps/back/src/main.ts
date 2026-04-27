import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import multer from 'multer';

import { getConnectionStats, testConnection } from './adapters/db/pg.connector';
import { UPLOAD_DIR } from './globals';
import {
  dbErrorMiddleware,
  dbLoggingMiddleware,
  sequelizeErrorMiddleware,
} from './middleware';
import api from './routes';

// Debug: Mostrar variables de entorno cargadas
console.log('🔍 Environment variables loaded:');
console.log('POSTGRESDB_HOST:', process.env.POSTGRESDB_HOST);
console.log('POSTGRESDB_PORT:', process.env.POSTGRESDB_PORT);
console.log('POSTGRESDB_DATABASE:', process.env.POSTGRESDB_DATABASE);
console.log('POSTGRESDB_USER:', process.env.POSTGRESDB_USER);
console.log(
  'POSTGRESDB_PASSWORD:',
  process.env.POSTGRESDB_PASSWORD ? '***' : 'undefined',
);

class Main {
  #app: express.Application;
  #upload: multer.Multer;
  #port: number;

  constructor(port: number) {
    this.#app = express();
    this.#upload = multer();
    this.#port = port;
  }

  async start() {
    // Configurar la aplicación primero
    this.#config();
    this.#setRoutes();

    // Iniciar el servidor independientemente del estado de la DB
    this.#app.listen(this.#port, '0.0.0.0', () => {
      console.log(`🚀 Server is running on port ${this.#port}`);
      console.log(
        '⚠️ Note: Database connection will be attempted in the background',
      );
    });

    // Intentar conectar a la base de datos en segundo plano
    this.#attemptDatabaseConnection();
  }

  async #attemptDatabaseConnection() {
    console.log('🔄 Attempting to connect to database in background...');

    const dbConnected = await testConnection();
    if (dbConnected) {
      console.log('✅ Database connection established successfully');
      this.#startHealthCheck();
    } else {
      console.log(
        '⚠️ Database connection failed, but server continues running',
      );
      console.log('🔄 Will retry database connection automatically...');
      this.#startHealthCheck();
    }
  }

  #startHealthCheck() {
    // Health check cada 30 segundos para verificar el estado de la DB
    setInterval(() => {
      const stats = getConnectionStats();
      if (!stats.isConnected) {
        console.log('⚠️ Database connection lost, attempting to reconnect...');
        this.#attemptDatabaseConnection();
      }
    }, 30000); // 30 segundos
  }

  #config() {
    // Detrás de Traefik
    this.#app.set('trust proxy', 1);

    // Configure CORS for subdomain deployment
    const corsOptions = {
      origin: ['https://starter.your-domain.es', 'http://localhost:4200'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Refresh-Token'],
    };

    this.#app.use(cors(corsOptions));
    this.#app.use(cookieParser());
    this.#app.use(express.json());

    // Middlewares de base de datos
    this.#app.use(dbLoggingMiddleware);
    this.#app.use(dbErrorMiddleware);

    // static files, pdf and front page images
    this.#app.use(
      process.env.NODE_UPLOAD_FILES
        ? `/${process.env.NODE_UPLOAD_FILES}`
        : '/uploads',
      express.static(UPLOAD_DIR),
    );

    // expose authorization headers (RefreshToken is now in cookie, not header)
    this.#app.use((_, res, next) => {
      res.setHeader('Access-Control-Expose-Headers', 'Authorization');
      next();
    });
  }
  #setRoutes() {
    try {
      this.#app.use('/api', api);

      // Middleware de manejo de errores de Sequelize (debe ir después de las rutas)
      this.#app.use(sequelizeErrorMiddleware);
    } catch (error) {
      console.error(error);
    }
  }
}
const PORT = process.env.NODE_PORT
  ? Number(process.env.NODE_PORT)
  : Number('3200');
const main = new Main(PORT);
main.start().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
