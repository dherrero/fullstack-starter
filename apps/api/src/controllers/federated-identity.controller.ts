import HttpResponser from '@api/adapters/http/http.responser';
import { federatedIdentityService } from '@api/services';
import type { ResolveFederatedUserRequestDTO } from '@dto';
import type { Request, Response } from 'express';

class FederatedIdentityController {
  /**
   * Resolves or provisions a local user from a validated federated identity.
   * Reachable only through `requireInternalAuth` with the `federated.identity`
   * scope, so the gateway is the sole legitimate caller. The request body is
   * validated by `resolveFederatedUserSchema` before reaching this handler.
   */
  resolve = async (req: Request, res: Response) => {
    try {
      const input = req.body as ResolveFederatedUserRequestDTO;
      const result = await federatedIdentityService.resolveOrProvision(input);
      return HttpResponser.successJson(res, result);
    } catch {
      // Generic message on purpose: never leak which branch failed
      // (unverified email vs. collision vs. db error).
      return HttpResponser.errorJson(
        res,
        { message: 'Federated identity could not be resolved.' },
        400,
      );
    }
  };
}

const federatedIdentityController = new FederatedIdentityController();
export default federatedIdentityController;
