import { requireInternalAuth } from '@internal-auth';
import { Router } from 'express';
import { getConnectionStats, isConnected } from '../adapters/db/pg.connector';

const healthRouter = Router();

// Detailed/db probes are gated behind a valid internal (gateway-signed) token.
// Any scope is accepted — these are operational endpoints, not business ones.
const requireInternal = requireInternalAuth({
  publicKey: process.env.INTERNAL_JWT_PUBLIC_KEY ?? '',
});

// Only the non-sensitive connection booleans/counters — never the DB host,
// port, name or dialect (those help an attacker target/fingerprint the DB).
const safeDbStats = () => {
  const {
    isConnected: connected,
    poolSize,
    available,
    using,
    waiting,
  } = getConnectionStats();
  return { isConnected: connected, poolSize, available, using, waiting };
};

/** Public liveness probe — intentionally minimal, leaks nothing. */
healthRouter.get('', (_, res) => {
  res.status(200).json({ health: '👌', timestamp: new Date().toISOString() });
});

healthRouter.get('/db', requireInternal, (_, res) => {
  const isDbConnected = isConnected();
  res.status(isDbConnected ? 200 : 503).json({
    health: isDbConnected ? '👌' : '⚠️',
    database: { connected: isDbConnected, stats: safeDbStats() },
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/detailed', requireInternal, (_, res) => {
  const isDbConnected = isConnected();
  res.status(isDbConnected ? 200 : 503).json({
    health: isDbConnected ? '👌' : '⚠️',
    // Operational metrics only — no nodeVersion / pid / platform fingerprinting.
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
    database: { connected: isDbConnected, stats: safeDbStats() },
    timestamp: new Date().toISOString(),
  });
});

export default healthRouter;
