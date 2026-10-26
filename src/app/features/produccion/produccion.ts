import { OrdenProduccionResumenDto } from '../../api/models/orden-produccion-resumen-dto';
import { EntregaProcesoDto } from '../../api/models/entrega-proceso-dto';

export type EstadoOrden = NonNullable<OrdenProduccionResumenDto['estado']>;

export const NOMBRE_ESTADO_ORDEN: Record<EstadoOrden, string> = {
  ABIERTA: 'Abierta',
  TERMINADA: 'Terminada',
  ANULADA: 'Anulada',
};

export const NOMBRE_TIPO_ENTREGA: Record<NonNullable<EntregaProcesoDto['tipo']>, string> = {
  AVANCE: 'Entrega',
  DEVOLUCION: 'Devolución',
  BAJA: 'Baja',
};
