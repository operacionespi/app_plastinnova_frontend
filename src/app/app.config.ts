import { DATE_PIPE_DEFAULT_OPTIONS, registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEsCo from '@angular/common/locales/es-CO';
import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { provideApiConfiguration } from './api/api-configuration';
import { routes } from './app.routes';
import { Sesion } from './core/auth/sesion';
import { erroresInterceptor, tokenInterceptor } from './core/http/interceptores';
import { TituloPagina } from './core/navegacion/titulo-pagina';
import { ZONA_PLANTA } from './core/ui/fechas';

registerLocaleData(localeEsCo);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([tokenInterceptor, erroresInterceptor])),
    // Rutas relativas (/api/...): en desarrollo las atiende proxy.conf.json y en producción el proxy inverso
    provideApiConfiguration(''),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    // Hora de la planta aunque el equipo tenga otra zona configurada
    { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: ZONA_PLANTA } },
    { provide: TitleStrategy, useClass: TituloPagina },
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
      // Las rutas se evalúan después: los guards ya conocen al usuario de la sesión guardada
      return inject(Sesion).restaurar();
    }),
  ],
};
