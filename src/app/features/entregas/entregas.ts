import { RemisionDto } from '../../api/models/remision-dto';

export const NOMBRE_ESTADO_REMISION: Record<NonNullable<RemisionDto['estado']>, string> = {
  EMITIDA: 'Emitida',
  ANULADA: 'Anulada',
};
