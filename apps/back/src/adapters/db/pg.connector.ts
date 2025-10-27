import { Sequelize } from 'sequelize';

// Configuración de reintentos desde variables de entorno
const RETRY_CONFIG = {
  maxRetries: parseInt(process.env.DB_MAX_RETRIES || '10'),
  retryDelay: parseInt(process.env.DB_RETRY_DELAY || '5000'), // 5 segundos
  maxRetryDelay: parseInt(process.env.DB_MAX_RETRY_DELAY || '30000'), // 30 segundos
  backoffMultiplier: parseFloat(process.env.DB_BACKOFF_MULTIPLIER || '1.5'),
  jitter: process.env.DB_JITTER === 'true' || true, // Añadir aleatoriedad para evitar thundering herd
};

// Configuración de la base de datos con valores por defecto y mejor manejo de errores
const dbConfig = {
  dialect: 'postgres' as const,
  host: process.env.POSTGRESDB_HOST ?? 'postgresdb',
  port: process.env.POSTGRESDB_PORT
    ? Number(process.env.POSTGRESDB_PORT)
    : 5432,
  database: process.env.POSTGRESDB_DATABASE ?? 'your_db_name',
  username: process.env.POSTGRESDB_USER ?? 'postgres',
  password: process.env.POSTGRESDB_PASSWORD ?? 'password',
  logging: process.env.NODE_PRODUCTION === 'true' ? false : console.log,
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    min: parseInt(process.env.DB_POOL_MIN || '0'),
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || '60000'),
    idle: parseInt(process.env.DB_POOL_IDLE || '10000'),
    evict: parseInt(process.env.DB_POOL_EVICT || '1000'),
    handleDisconnects: true,
  },
  retry: {
    match: [
      /ETIMEDOUT/,
      /EHOSTUNREACH/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /ESOCKETTIMEDOUT/,
      /EPIPE/,
      /EAI_AGAIN/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /SequelizeDatabaseError/,
      /SequelizeTimeoutError/,
    ],
    max: RETRY_CONFIG.maxRetries,
  },
  dialectOptions: {
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '60000'),
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'),
    timeout: parseInt(process.env.DB_TIMEOUT || '60000'),
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
  },
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true,
  },
  hooks: {
    beforeConnect: () => {
      console.log('🔄 Attempting to connect to database...');
    },
    afterConnect: () => {
      console.log('✅ Database connection established successfully');
    },
    beforeDisconnect: () => {
      console.log('⚠️ Database connection is being closed');
    },
    afterDisconnect: () => {
      console.log('❌ Database connection closed');
    },
  },
};

export const db = new Sequelize(dbConfig);

// Función para calcular el delay con backoff exponencial y jitter
const calculateRetryDelay = (attempt: number): number => {
  const baseDelay = RETRY_CONFIG.retryDelay;
  const exponentialDelay =
    baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
  const maxDelay = RETRY_CONFIG.maxRetryDelay;
  const delay = Math.min(exponentialDelay, maxDelay);

  if (RETRY_CONFIG.jitter) {
    // Añadir jitter para evitar thundering herd
    const jitterRange = delay * 0.1; // 10% de jitter
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    return Math.max(0, delay + jitter);
  }

  return delay;
};

// Función para probar la conexión con reintentos
export const testConnection = async (): Promise<boolean> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      console.log(
        `🔄 Database connection attempt ${attempt}/${RETRY_CONFIG.maxRetries}`
      );

      await db.authenticate();
      console.log('✅ Database connection has been established successfully.');

      // Configurar event listeners para reconexión automática
      setupReconnectionHandlers();

      return true;
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ Database connection attempt ${attempt} failed:`, error);

      // Si no es el último intento, esperar antes del siguiente
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = calculateRetryDelay(attempt);
        console.log(`⏳ Waiting ${Math.round(delay)}ms before next attempt...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(
    `❌ Failed to connect to database after ${RETRY_CONFIG.maxRetries} attempts`
  );
  console.error('Last error:', lastError);
  return false;
};

// Función para configurar manejadores de reconexión automática
const setupReconnectionHandlers = (): void => {
  // Configurar un timer para verificar la conexión periódicamente
  setInterval(async () => {
    try {
      await db.authenticate();
    } catch (error) {
      console.log('⚠️ Database connection lost, attempting to reconnect...');
      await attemptReconnection();
    }
  }, 30000); // Verificar cada 30 segundos
};

// Función para intentar reconexión automática
const attemptReconnection = async (): Promise<void> => {
  let attempt = 1;
  const maxReconnectAttempts = RETRY_CONFIG.maxRetries;

  while (attempt <= maxReconnectAttempts) {
    try {
      console.log(`🔄 Reconnection attempt ${attempt}/${maxReconnectAttempts}`);

      await db.authenticate();
      console.log('✅ Database reconnected successfully');
      return;
    } catch (error) {
      console.error(`❌ Reconnection attempt ${attempt} failed:`, error);

      if (attempt < maxReconnectAttempts) {
        const delay = calculateRetryDelay(attempt);
        console.log(
          `⏳ Waiting ${Math.round(
            delay
          )}ms before next reconnection attempt...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      attempt++;
    }
  }

  console.error(
    `❌ Failed to reconnect to database after ${maxReconnectAttempts} attempts`
  );
  console.error(
    '⚠️ Application will continue running but database operations may fail'
  );
};

// Función para verificar el estado de la conexión
export const isConnected = (): boolean => {
  try {
    // Verificar si la instancia de Sequelize está configurada
    return db !== null && db.connectionManager !== null;
  } catch {
    return false;
  }
};

// Función para obtener estadísticas de la conexión
export const getConnectionStats = () => {
  try {
    return {
      isConnected: isConnected(),
      poolSize: 0, // No disponible en esta versión de Sequelize
      available: 0,
      using: 0,
      waiting: 0,
      dialect: db.getDialect(),
      database: db.getDatabaseName(),
      host: process.env.POSTGRESDB_HOST || 'unknown',
      port: parseInt(process.env.POSTGRESDB_PORT || '5432'),
    };
  } catch {
    return {
      isConnected: false,
      poolSize: 0,
      available: 0,
      using: 0,
      waiting: 0,
      dialect: 'unknown',
      database: 'unknown',
      host: 'unknown',
      port: 0,
    };
  }
};

// Función para cerrar la conexión de forma segura
export const closeConnection = async (): Promise<void> => {
  try {
    console.log('🔄 Closing database connection...');
    await db.close();
    console.log('✅ Database connection closed successfully');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
};

// Manejar cierre graceful de la aplicación
process.on('SIGINT', async () => {
  console.log('🔄 Received SIGINT, closing database connection...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Received SIGTERM, closing database connection...');
  await closeConnection();
  process.exit(0);
});
