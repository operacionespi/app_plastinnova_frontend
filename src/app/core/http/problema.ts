import { HttpErrorResponse } from '@angular/common/http';

/** Error de la API ya traducido para mostrarlo al usuario. */
export interface Problema {
  estado: number;
  mensaje: string;
  /** Errores de validación por campo (invalid_params de ProblemDetail). */
  campos: Record<string, string>;
}

/** El backend responde los errores como ProblemDetail (RFC 9457) con `detail` en español. */
export function leerProblema(error: unknown): Problema {
  if (!(error instanceof HttpErrorResponse)) {
    return { estado: -1, mensaje: 'Ocurrió un error inesperado.', campos: {} };
  }
  if (error.status === 0) {
    return {
      estado: 0,
      mensaje: 'No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.',
      campos: {},
    };
  }
  const cuerpo = cuerpoComoObjeto(error.error);
  const campos = esTextoPorClave(cuerpo['invalid_params']) ? cuerpo['invalid_params'] : {};
  const detalle = typeof cuerpo['detail'] === 'string' ? cuerpo['detail'] : null;
  return { estado: error.status, mensaje: detalle ?? mensajePorEstado(error.status), campos };
}

/** Las operaciones sin cuerpo de respuesta (204) se piden como texto: su error llega como JSON en texto. */
function cuerpoComoObjeto(cuerpo: unknown): Record<string, unknown> {
  if (typeof cuerpo === 'string') {
    try {
      cuerpo = JSON.parse(cuerpo);
    } catch {
      return {};
    }
  }
  return typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
}

function mensajePorEstado(estado: number): string {
  if (estado === 401) return 'Su sesión no es válida. Ingrese de nuevo.';
  if (estado === 403) return 'No tiene permiso para realizar esta acción.';
  if (estado === 404) return 'El recurso solicitado no existe.';
  if (estado >= 500) return 'Error inesperado del servidor. Intente de nuevo en unos minutos.';
  return 'No se pudo completar la solicitud.';
}

function esTextoPorClave(valor: unknown): valor is Record<string, string> {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    Object.values(valor).every((v) => typeof v === 'string')
  );
}
