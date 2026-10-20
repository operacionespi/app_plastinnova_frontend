import { HttpContextToken } from '@angular/common/http';

/**
 * Marca una petición cuyos errores muestra quien la hizo (ej. en el formulario).
 * Sin esta marca el interceptor de errores los muestra en un aviso.
 */
export const MANEJA_ERRORES = new HttpContextToken<boolean>(() => false);
