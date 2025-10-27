// Services
export { AuthService } from './services/auth.service';

// Guards
export {
  canActivateWithAllPermissions,
  canActivateWithAnyPermission,
  canActivateWithPermission,
} from './guards/auth-permission.guard';
export { canActivateFn } from './guards/auth.guard';

// Directives
export {
  HasAllPermissionsDirective,
  HasAnyPermissionDirective,
  HasPermissionDirective,
  IfLoggedInDirective,
} from './directives';

// Interfaces
export { AuthConfig, Login, UserTokenData } from './auth.interface';

// Constants
export {
  AUTH_CONFIGURATION,
  REFRESH_TOKEN_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from './auth.constants';

// Providers (Modern approach - RECOMMENDED)
export { provideAuth } from './auth.provider';
