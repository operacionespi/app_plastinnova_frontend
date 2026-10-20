import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { COORDINADOR, GERENTE, OPERADOR } from '../../../testing/jwt';
import { Sesion } from '../auth/sesion';
import { Navegacion } from './navegacion';

type Usuario = typeof OPERADOR & { debeCambiarContrasena?: boolean };

function navegacionPara(usuario: Usuario | null): Navegacion {
  const actual = signal(usuario);
  const sesion = {
    autenticado: () => actual() !== null,
    roles: () => new Set(actual()?.roles ?? []),
    tienePermiso: (p: string) => actual()?.permisos.includes(p) ?? false,
    debeCambiarContrasena: () => !!actual()?.debeCambiarContrasena,
  };
  TestBed.configureTestingModule({ providers: [{ provide: Sesion, useValue: sesion }] });
  return TestBed.inject(Navegacion);
}

describe('Navegacion', () => {
  it('operador: cola y búsqueda en modo tablet, entra a la cola', () => {
    const nav = navegacionPara(OPERADOR);
    expect(nav.opciones().map((o) => o.etiqueta)).toEqual(['Cola de trabajo', 'Buscar pedido']);
    expect(nav.modoTablet()).toBe(true);
    expect(nav.rutaInicio()).toBe('/operador/cola');
  });

  it('coordinador: menú completo, sin búsqueda de operador, entra a pedidos', () => {
    const nav = navegacionPara(COORDINADOR);
    expect(nav.opciones().map((o) => o.etiqueta)).toEqual([
      'Pedidos',
      'Cola de trabajo',
      'Tableros',
      'Estados',
      'Sincronización',
    ]);
    expect(nav.modoTablet()).toBe(false);
    expect(nav.rutaInicio()).toBe('/pedidos');
  });

  it('sin sesión el inicio es el login (la redirección corre antes que los guards)', () => {
    expect(navegacionPara(null).rutaInicio()).toBe('/login');
  });

  it('gerencia: solo consulta, entra a los tableros', () => {
    const nav = navegacionPara(GERENTE);
    expect(nav.opciones().map((o) => o.etiqueta)).toEqual(['Pedidos', 'Tableros']);
    expect(nav.rutaInicio()).toBe('/gerencia/tablero');
    expect(nav.nombreRoles()).toBe('Gerencia');
  });

  it('administrador: además gestiona usuarios', () => {
    const admin = {
      ...COORDINADOR,
      roles: ['ADMIN'],
      permisos: [...COORDINADOR.permisos, 'usuario:gestionar'],
    };
    expect(navegacionPara(admin).opciones().at(-1)?.etiqueta).toBe('Usuarios');
  });

  it('con contraseña temporal entra a cambiarla', () => {
    const nav = navegacionPara({ ...OPERADOR, permisos: [], debeCambiarContrasena: true });
    expect(nav.opciones()).toEqual([]);
    expect(nav.rutaInicio()).toBe('/cuenta');
  });
});
