import { Router } from 'express';
import { getConnectionStats, isConnected } from '../adapters/db/pg.connector';

const healthRouter = Router();

healthRouter.get('', (_, res) => {
  res.status(200).json({
    health: '👌',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

healthRouter.get('/db', (_, res) => {
  const dbStats = getConnectionStats();
  const isDbConnected = isConnected();

  const response = {
    health: isDbConnected ? '👌' : '⚠️',
    database: {
      connected: isDbConnected,
      stats: dbStats,
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  res.status(isDbConnected ? 200 : 503).json(response);
});

healthRouter.get('/detailed', (_, res) => {
  const dbStats = getConnectionStats();
  const isDbConnected = isConnected();

  const response = {
    health: isDbConnected ? '👌' : '⚠️',
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid,
    },
    database: {
      connected: isDbConnected,
      stats: dbStats,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(isDbConnected ? 200 : 503).json(response);
});

export default healthRouter;
