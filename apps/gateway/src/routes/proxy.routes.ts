import { hasPermission } from '@gateway/middleware/auth.middleware';
import {
  INTERNAL_AUTH_HEADER,
  INTERNAL_REQUEST_ID_HEADER,
  signUserContext,
} from '@internal-auth';
import { randomUUID } from 'crypto';
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

const upstream = () =>
  process.env.API_BASE_URL?.replace(/\/$/, '') ?? 'http://api:3200';

const internalSecret = () => process.env.INTERNAL_JWT_SECRET ?? '';

/**
 * Build the proxy middleware that forwards `/v1/*` to the api service.
 * Before forwarding, the request must pass `hasPermission`, which
 * populates `res.locals.user`. The request id and the freshly-signed
 * internal JWT are attached as headers so the api can authenticate the
 * call without re-validating the public access token.
 */
export const buildProxyRouter = (): Router => {
  const router = Router();

  router.use(
    hasPermission(),
    (req: Request, res: Response, next: NextFunction) => {
      const user = res.locals.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const requestId =
        (req.header(INTERNAL_REQUEST_ID_HEADER) as string) ?? randomUUID();
      const internalToken = signUserContext(
        {
          userId: user.id,
          permissions: user.permissions,
          requestId,
        },
        { secret: internalSecret() },
      );
      (req as Request & { internalToken?: string }).internalToken =
        internalToken;
      (req as Request & { internalRequestId?: string }).internalRequestId =
        requestId;
      return next();
    },
    createProxyMiddleware({
      target: upstream(),
      changeOrigin: true,
      xfwd: true,
      pathRewrite: (path) => `/v1${path}`,
      on: {
        proxyReq: (proxyReq, req) => {
          const carrier = req as Request & {
            internalToken?: string;
            internalRequestId?: string;
          };
          if (carrier.internalToken) {
            proxyReq.setHeader(INTERNAL_AUTH_HEADER, carrier.internalToken);
          }
          if (carrier.internalRequestId) {
            proxyReq.setHeader(
              INTERNAL_REQUEST_ID_HEADER,
              carrier.internalRequestId,
            );
          }
          // Restream the JSON body parsed by express.json()
          fixRequestBody(proxyReq, req);
        },
      },
    }),
  );

  return router;
};
