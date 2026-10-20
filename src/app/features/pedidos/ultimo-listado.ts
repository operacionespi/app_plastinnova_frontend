import { Service, signal } from '@angular/core';

/** Última URL del listado (con sus filtros): el detalle vuelve ahí y no a un listado vacío. */
@Service()
export class UltimoListado {
  readonly url = signal('/pedidos');
}
