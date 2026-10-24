import { HttpContext } from '@angular/common/http';
import { inject, resource, Service } from '@angular/core';
import { Api } from '../../api/api';
import { inventarioBodegas } from '../../api/fn/inventario/inventario-bodegas';
import { inventarioSlots } from '../../api/fn/inventario/inventario-slots';
import { MovimientoDto } from '../../api/models/movimiento-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';

export type TipoMovimiento = NonNullable<MovimientoDto['tipo']>;
/** Los que se registran a mano; la carga inicial va por el CSV. */
export type TipoMovimientoManual = Exclude<TipoMovimiento, 'CARGA_INICIAL'>;

export const NOMBRE_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  TRASLADO: 'Traslado',
  AJUSTE: 'Ajuste por conteo',
  CARGA_INICIAL: 'Carga inicial',
};

/**
 * Bodegas y slots para los filtros y formularios del inventario. Se piden una vez por sesión de la página y se
 * recargan después de crear o modificar un slot.
 */
@Service()
export class CatalogoInventario {
  private readonly api = inject(Api);

  readonly bodegas = resource({
    loader: () =>
      this.api.invoke(inventarioBodegas, {}, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  readonly slots = resource({
    loader: () => this.api.invoke(inventarioSlots, {}, new HttpContext().set(MANEJA_ERRORES, true)),
  });
}
