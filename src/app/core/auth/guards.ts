import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Navegacion } from '../navegacion/navegacion';
import { Sesion } from './sesion';

/** Rutas privadas: sin sesión se va al login y luego se vuelve a la ruta pedida. */
export const autenticadoGuard: CanActivateFn = (_ruta, estado) => {
  if (inject(Sesion).autenticado()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login'], { queryParams: { volver: estado.url } });
};

/** Exige el permiso indicado en `data.permiso` de la ruta (el backend vuelve a validarlo). */
export const permisoGuard: CanActivateFn = (ruta) => {
  const permiso = ruta.data['permiso'] as string | undefined;
  if (!permiso || inject(Sesion).tienePermiso(permiso)) {
    return true;
  }
  return inject(Router).createUrlTree(['/sin-acceso']);
};

export const RUTA_CUENTA = '/cuenta';

/** Con contraseña temporal solo se puede ir a cambiarla (el backend no le da permisos hasta entonces). */
export const contrasenaTemporalGuard: CanActivateFn = (_ruta, estado) => {
  if (!inject(Sesion).debeCambiarContrasena() || estado.url.startsWith(RUTA_CUENTA)) {
    return true;
  }
  return inject(Router).parseUrl(RUTA_CUENTA);
};

/** El login solo para quien no tiene sesión. */
export const invitadoGuard: CanActivateFn = () => {
  if (!inject(Sesion).autenticado()) {
    return true;
  }
  return inject(Router).parseUrl(inject(Navegacion).rutaInicio());
};
