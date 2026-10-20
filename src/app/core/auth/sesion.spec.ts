import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideApiConfiguration } from '../../api/api-configuration';
import { OPERADOR, tokenQueExpiraEn } from '../../../testing/jwt';
import { erroresInterceptor, tokenInterceptor } from '../http/interceptores';
import { Sesion } from './sesion';

describe('Sesion', () => {
  let sesion: Sesion;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([tokenInterceptor, erroresInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
      ],
    });
    sesion = TestBed.inject(Sesion);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('al ingresar guarda el token y carga el usuario con sus permisos', async () => {
    const token = tokenQueExpiraEn(3_600_000);
    const ingreso = sesion.iniciarSesion('operador@plastinnova.test', 'clave');

    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.body).toEqual({ email: 'operador@plastinnova.test', password: 'clave' });
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush({ accessToken: token, tokenType: 'Bearer' });

    const me = await vi.waitFor(() => http.expectOne('/api/v1/auth/me'));
    expect(me.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    me.flush(OPERADOR);
    await ingreso;

    expect(sesion.autenticado()).toBe(true);
    expect(sesion.tienePermiso('detalle:cambiar-estado')).toBe(true);
    expect(sesion.tienePermiso('kpi:ver')).toBe(false);
    expect(localStorage.getItem('pi.token')).toBe(token);
  });

  it('con credenciales inválidas propaga el error y no guarda nada', async () => {
    const ingreso = sesion.iniciarSesion('x@plastinnova.test', 'mala');
    http
      .expectOne('/api/v1/auth/login')
      .flush(
        { detail: 'Email o contraseña incorrectos.' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await expect(ingreso).rejects.toMatchObject({ status: 401 });
    expect(sesion.autenticado()).toBe(false);
    expect(localStorage.getItem('pi.token')).toBeNull();
  });

  it('restaura la sesión guardada si el token sigue vigente', async () => {
    localStorage.setItem('pi.token', tokenQueExpiraEn(3_600_000));
    const restauracion = sesion.restaurar();
    http.expectOne('/api/v1/auth/me').flush(OPERADOR);
    await restauracion;
    expect(sesion.usuario()?.nombreCompleto).toBe('Olga Operadora');
  });

  it('descarta un token vencido sin llamar a la API', async () => {
    localStorage.setItem('pi.token', tokenQueExpiraEn(-1000));
    await sesion.restaurar();
    http.expectNone('/api/v1/auth/me');
    expect(sesion.token()).toBeNull();
    expect(localStorage.getItem('pi.token')).toBeNull();
  });

  it('si el servidor rechaza el token guardado, se borra', async () => {
    localStorage.setItem('pi.token', tokenQueExpiraEn(3_600_000));
    const restauracion = sesion.restaurar();
    http.expectOne('/api/v1/auth/me').flush({}, { status: 404, statusText: 'Not Found' });
    await restauracion;
    expect(sesion.autenticado()).toBe(false);
    expect(localStorage.getItem('pi.token')).toBeNull();
  });

  it('cierra la sesión sola cuando el token expira', async () => {
    vi.useFakeTimers();
    try {
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      localStorage.setItem('pi.token', tokenQueExpiraEn(60_000));
      const restauracion = sesion.restaurar();
      http.expectOne('/api/v1/auth/me').flush(OPERADOR);
      await restauracion;

      vi.advanceTimersByTime(61_000);

      expect(sesion.autenticado()).toBe(false);
      expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { motivo: 'expirada' } });
    } finally {
      vi.useRealTimers();
    }
  });
});
