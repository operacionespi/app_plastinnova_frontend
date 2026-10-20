import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { Sesion } from '../../core/auth/sesion';
import { Navegacion } from '../../core/navegacion/navegacion';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  const sesion = {
    iniciarSesion: vi.fn(),
    autenticado: () => false,
    roles: () => new Set(),
    tienePermiso: () => false,
  };
  const navegacion = { rutaInicio: () => '/operador/cola' };
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    sesion.iniciarSesion.mockReset();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: Sesion, useValue: sesion },
        { provide: Navegacion, useValue: navegacion },
      ],
    });
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
  });

  const escribir = (selector: string, valor: string) => {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
  };
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('no envía si faltan datos y muestra los errores', async () => {
    await enviar();
    expect(sesion.iniciarSesion).not.toHaveBeenCalled();
    expect(texto()).toContain('Ingrese su email.');
    expect(texto()).toContain('Ingrese su contraseña.');
  });

  it('ingresa y va a la ruta pedida o al inicio del rol', async () => {
    sesion.iniciarSesion.mockResolvedValue(undefined);
    escribir('input[type=email]', ' operador@plastinnova.test ');
    escribir('input[autocomplete=current-password]', 'clave');
    await enviar();
    expect(sesion.iniciarSesion).toHaveBeenCalledWith('operador@plastinnova.test', 'clave');
    expect(navegar).toHaveBeenCalledWith('/operador/cola');

    fixture.componentRef.setInput('volver', '/pedidos');
    await enviar();
    expect(navegar).toHaveBeenLastCalledWith('/pedidos');

    // Un destino externo se ignora
    fixture.componentRef.setInput('volver', '//sitio-malicioso.com');
    await enviar();
    expect(navegar).toHaveBeenLastCalledWith('/operador/cola');
  });

  it('muestra el error del backend', async () => {
    sesion.iniciarSesion.mockRejectedValue(
      new HttpErrorResponse({ status: 401, error: { detail: 'Email o contraseña incorrectos.' } }),
    );
    escribir('input[type=email]', 'operador@plastinnova.test');
    escribir('input[autocomplete=current-password]', 'mala');
    await enviar();
    fixture.detectChanges();
    expect(texto()).toContain('Email o contraseña incorrectos.');
    expect(navegar).not.toHaveBeenCalled();
  });
});
