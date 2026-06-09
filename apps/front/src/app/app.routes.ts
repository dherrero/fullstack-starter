import { Route } from '@angular/router';
import { canActivateFn } from './libs/auth/guards/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component'),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component'),
  },
  // Example PROTECTED route — the guard redirects anonymous users to /login.
  // Use canActivateWithPermission(...) from auth-permission.guard.ts for routes
  // that also require a specific permission. Guards are UX only; the backend is
  // the real authorization boundary.
  {
    path: 'profile',
    canActivate: [canActivateFn],
    loadComponent: () => import('./pages/profile/profile.component'),
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./pages/unauthorized/unauthorized.component'),
  },
  // Unknown routes fall back to the landing page instead of a blank 404.
  {
    path: '**',
    redirectTo: '',
  },
];
