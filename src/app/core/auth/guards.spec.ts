import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Sesion } from './sesion';
import { autenticadoGuard, contrasenaTemporalGuard, invitadoGuard, permisoGuard } from './guards';

describe('guards', () => {
  let autenticado = false;
  let temporal = false;
  const permisos = new Set<string>();

  beforeEach(() => {
    autenticado = false;
    temporal = false;
    permisos.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Sesion,
          useValue: {
            autenticado: () => autenticado,
            debeCambiarContrasena: () => temporal,
            tienePermiso: (p: string) => permisos.has(p),
            roles: () => new Set(['OPERADOR']),
          },
        },
      ],
    });
  });

  const ejecutar = (
    guard: typeof permisoGuard,
    data: Record<string, unknown> = {},
    url = '/pedidos',
  ) =>
    TestBed.runInInjectionContext(() =>
      guard({ data } as unknown as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  const url = (resultado: unknown) => TestBed.inject(Router).serializeUrl(resultado as UrlTree);

  it('sin sesión manda al login recordando la ruta', () => {
    expect(url(ejecutar(autenticadoGuard, {}, '/operador/cola'))).toBe(
      '/login?volver=%2Foperador%2Fcola',
    );
    autenticado = true;
    expect(ejecutar(autenticadoGuard)).toBe(true);
  });

  it('sin el permiso de la ruta manda a sin-acceso', () => {
    expect(url(ejecutar(permisoGuard, { permiso: 'kpi:ver' }))).toBe('/sin-acceso');
    permisos.add('kpi:ver');
    expect(ejecutar(permisoGuard, { permiso: 'kpi:ver' })).toBe(true);
    expect(ejecutar(permisoGuard)).toBe(true);
  });

  it('con sesión, el login redirige al inicio del rol', () => {
    expect(ejecutar(invitadoGuard)).toBe(true);
    autenticado = true;
    permisos.add('detalle:cambiar-estado');
    expect(url(ejecutar(invitadoGuard))).toBe('/operador/cola');
  });

  it('con contraseña temporal solo deja ir a cambiarla', () => {
    expect(ejecutar(contrasenaTemporalGuard)).toBe(true);
    temporal = true;
    expect(url(ejecutar(contrasenaTemporalGuard, {}, '/pedidos'))).toBe('/cuenta');
    expect(ejecutar(contrasenaTemporalGuard, {}, '/cuenta')).toBe(true);
  });
});
