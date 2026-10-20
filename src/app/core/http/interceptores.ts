import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Sesion } from '../auth/sesion';
import { Avisos } from '../ui/avisos';
import { MANEJA_ERRORES } from './contexto';
import { leerProblema } from './problema';

const RUTA_LOGIN = '/api/v1/auth/login';

/** Agrega el token a las llamadas a la API (mismo origen), excepto al login. */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(Sesion).token();
  if (!token || !esApi(req) || req.url.endsWith(RUTA_LOGIN)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/**
 * 401 con sesión abierta: el token venció o el usuario se desactivó → se cierra la sesión.
 * Otros errores se muestran en un aviso, salvo que la petición los maneje (MANEJA_ERRORES).
 */
export const erroresInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(Sesion);
  const avisos = inject(Avisos);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && esApi(req)) {
        if (error.status === 401 && sesion.token() && !req.url.endsWith(RUTA_LOGIN)) {
          sesion.cerrarSesion('expirada');
        } else if (!req.context.get(MANEJA_ERRORES)) {
          avisos.error(leerProblema(error).mensaje);
        }
      }
      return throwError(() => error);
    }),
  );
};

function esApi(req: HttpRequest<unknown>): boolean {
  return req.url.startsWith('/api/');
}
