import { KpiProduccionOperadorDto } from '../../api/models/kpi-produccion-operador-dto';

export interface CeldaProduccion {
  piezas: number;
  movimientos: number;
}

export interface FilaProduccion {
  usuarioId: number;
  nombre: string;
  /** Por id de etapa; no está si el operador no reportó en esa etapa. */
  etapas: Record<number, CeldaProduccion>;
  totalPiezas: number;
  totalMovimientos: number;
}

export interface TablaProduccion {
  /** Etapas con al menos un reporte, en el orden del proceso. */
  etapas: { id: number; nombre: string }[];
  /** De mayor a menor producción. */
  filas: FilaProduccion[];
}

/**
 * El backend devuelve una fila por operador y etapa; el tablero muestra operadores × etapas.
 * `orden` es el orden lógico de cada etapa (las que no estén en el catálogo van al final).
 */
export function tablaProduccion(
  datos: readonly KpiProduccionOperadorDto[],
  orden: ReadonlyMap<number, number>,
): TablaProduccion {
  const etapas = new Map<number, string>();
  const filas = new Map<number, FilaProduccion>();
  for (const d of datos) {
    const usuarioId = d.usuarioId ?? 0;
    const estadoId = d.estadoId ?? 0;
    etapas.set(estadoId, d.estadoNombre ?? '');
    let fila = filas.get(usuarioId);
    if (!fila) {
      fila = {
        usuarioId,
        nombre: d.usuarioNombre ?? '',
        etapas: {},
        totalPiezas: 0,
        totalMovimientos: 0,
      };
      filas.set(usuarioId, fila);
    }
    const piezas = d.piezas ?? 0;
    const movimientos = d.movimientos ?? 0;
    fila.etapas[estadoId] = { piezas, movimientos };
    fila.totalPiezas += piezas;
    fila.totalMovimientos += movimientos;
  }
  const posicion = (id: number) => orden.get(id) ?? Number.MAX_SAFE_INTEGER;
  return {
    etapas: [...etapas]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => posicion(a.id) - posicion(b.id)),
    filas: [...filas.values()].sort(
      (a, b) =>
        b.totalPiezas - a.totalPiezas ||
        b.totalMovimientos - a.totalMovimientos ||
        a.nombre.localeCompare(b.nombre),
    ),
  };
}
