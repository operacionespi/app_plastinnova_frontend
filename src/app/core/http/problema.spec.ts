import { HttpErrorResponse } from '@angular/common/http';
import { leerProblema } from './problema';

describe('leerProblema', () => {
  it('usa el detail y los invalid_params del ProblemDetail', () => {
    const problema = leerProblema(
      new HttpErrorResponse({
        status: 400,
        error: {
          detail: 'Errores de validación.',
          invalid_params: { email: 'Formato de email inválido' },
        },
      }),
    );
    expect(problema).toEqual({
      estado: 400,
      mensaje: 'Errores de validación.',
      campos: { email: 'Formato de email inválido' },
    });
  });

  it('lee el ProblemDetail que llega como texto (operaciones con respuesta 204)', () => {
    const problema = leerProblema(
      new HttpErrorResponse({
        status: 400,
        error: '{"detail":"La contraseña actual no es correcta."}',
      }),
    );
    expect(problema.mensaje).toBe('La contraseña actual no es correcta.');
    expect(leerProblema(new HttpErrorResponse({ status: 400, error: 'no es json' })).mensaje).toBe(
      'No se pudo completar la solicitud.',
    );
  });

  it('da mensajes claros sin cuerpo o sin conexión', () => {
    expect(leerProblema(new HttpErrorResponse({ status: 0 })).mensaje).toContain(
      'No se pudo conectar',
    );
    expect(leerProblema(new HttpErrorResponse({ status: 403 })).mensaje).toContain(
      'No tiene permiso',
    );
    expect(leerProblema(new HttpErrorResponse({ status: 503 })).mensaje).toContain(
      'Error inesperado del servidor',
    );
    expect(leerProblema(new Error('x')).mensaje).toBe('Ocurrió un error inesperado.');
  });
});
