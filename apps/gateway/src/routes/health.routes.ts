import { hasPermission } from '@gateway/middleware/auth.middleware';
import { Router } from 'express';

const healthRouter = Router();

healthRouter.get('/', (_, res) => {
  res.status(200).json({
    health: '👌',
    service: 'gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * `/secure` is used by the SPA on boot to detect whether the refresh
 * cookie is still valid and to lazily mint a new access token.
 */
healthRouter.get('/secure', hasPermission(), (_, res) => {
  res.status(200).json({
    health: '👌',
    secure: '🔐',
    service: 'gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default healthRouter;
