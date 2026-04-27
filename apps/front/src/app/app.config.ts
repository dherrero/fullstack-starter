import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { env } from '../environments/environment';
import { appRoutes } from './app.routes';
import {
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE,
} from './constants/languages.constant';
import { provideAuth } from './libs/auth';
import { TranslocoHttpLoader } from './services/transloco-loader.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptorsFromDi()),
    provideTransloco({
      config: {
        availableLangs: AVAILABLE_LANGUAGES.map((lang) => lang.code),
        defaultLang: DEFAULT_LANGUAGE,
        reRenderOnLangChange: true,
        prodMode: env.production,
        fallbackLang: DEFAULT_LANGUAGE,
      },
      loader: TranslocoHttpLoader,
    }),
    // Modern provider for authentication (replaces deprecated AuthModule)
    ...provideAuth({
      idpServer: env.api + 'auth',
      pingUrl: env.api + 'health/secure',
    }),
  ],
};
