import { OrdenProduccionResumenDto } from '../../api/models/orden-produccion-resumen-dto';

export type EstadoOrden = NonNullable<OrdenProduccionResumenDto['estado']>;

export const NOMBRE_ESTADO_ORDEN: Record<EstadoOrden, string> = {
  ABIERTA: 'Abierta',
  TERMINADA: 'Terminada',
  ANULADA: 'Anulada',
};
