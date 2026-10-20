import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { provideApiConfiguration } from '../../api/api-configuration';
import { OPERADOR, tokenQueExpiraEn } from '../../../testing/jwt';
import { Sesion } from '../auth/sesion';
import { Avisos } from '../ui/avisos';
import { MANEJA_ERRORES } from './contexto';
import { erroresInterceptor, tokenInterceptor } from './interceptores';

describe('interceptores', () => {
  let http: HttpTestingController;
  let cliente: HttpClient;
  let sesion: Sesion;
  const avisos = { error: vi.fn(), exito: vi.fn() };
  const token = tokenQueExpiraEn(3_600_000);

  beforeEach(async () => {
    localStorage.clear();
    avisos.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        // El 401 navega al login
        provideRouter([{ path: 'login', children: [] }]),
        provideHttpClient(withInterceptors([tokenInterceptor, erroresInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
        { provide: Avisos, useValue: avisos },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    cliente = TestBed.inject(HttpClient);
    sesion = TestBed.inject(Sesion);
    // Sesión abierta
    localStorage.setItem('pi.token', token);
    const restauracion = sesion.restaurar();
    http.expectOne('/api/v1/auth/me').flush(OPERADOR);
    await restauracion;
  });

  afterEach(() => http.verify());

  it('agrega el token solo a la API del mismo origen', () => {
    cliente.get('/api/v1/pedidos/1').subscribe();
    cliente.get('https://otro.sitio/datos').subscribe();
    expect(http.expectOne('/api/v1/pedidos/1').request.headers.get('Authorization')).toBe(
      `Bearer ${token}`,
    );
    expect(http.expectOne('https://otro.sitio/datos').request.headers.has('Authorization')).toBe(
      false,
    );
  });

  it('muestra el detail del error en un aviso', async () => {
    const peticion = firstValueFrom(cliente.put('/api/v1/pedidos/1/estado', {}));
    http
      .expectOne('/api/v1/pedidos/1/estado')
      .flush({ detail: 'Transición no permitida.' }, { status: 409, statusText: 'Conflict' });
    await expect(peticion).rejects.toBeTruthy();
    expect(avisos.error).toHaveBeenCalledWith('Transición no permitida.');
  });

  it('no muestra aviso si la petición maneja sus errores', async () => {
    const contexto = new HttpContext().set(MANEJA_ERRORES, true);
    const peticion = firstValueFrom(cliente.get('/api/v1/pedidos/1', { context: contexto }));
    http.expectOne('/api/v1/pedidos/1').flush({}, { status: 404, statusText: 'Not Found' });
    await expect(peticion).rejects.toBeTruthy();
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('un 401 con sesión abierta cierra la sesión', async () => {
    const peticion = firstValueFrom(cliente.get('/api/v1/pedidos/1'));
    http.expectOne('/api/v1/pedidos/1').flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(peticion).rejects.toBeTruthy();
    expect(sesion.autenticado()).toBe(false);
    expect(avisos.error).not.toHaveBeenCalled();
  });
});
