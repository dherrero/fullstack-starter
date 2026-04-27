import { Route } from '@angular/router';
import { canActivateFn } from '@front/app/libs/auth/guards/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component'),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component'),
  },
  {
    path: 'templates',
    canActivate: [canActivateFn],
    loadComponent: () =>
      import('./pages/templates/index/templates-index.component'),
  },
  {
    path: 'templates/landing',
    loadComponent: () => import('./pages/templates/landing/landing.component'),
  },
  {
    path: 'templates/dashboard',
    canActivate: [canActivateFn],
    loadComponent: () =>
      import('./pages/templates/dashboard/dashboard.component'),
  },
  {
    path: 'templates/catalog',
    canActivate: [canActivateFn],
    loadComponent: () => import('./pages/templates/catalog/catalog.component'),
  },
  {
    path: 'templates/list',
    canActivate: [canActivateFn],
    loadComponent: () => import('./pages/templates/list/list.component'),
  },
  {
    path: 'templates/settings',
    canActivate: [canActivateFn],
    loadComponent: () =>
      import('./pages/templates/settings/settings.component'),
  },
];
