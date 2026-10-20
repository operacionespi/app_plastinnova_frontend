import { Params } from '@angular/router';
import { FiltroPedidoRequestDto } from '../../api/models/filtro-pedido-request-dto';

/** Filtros del listado tal como los edita el usuario. Viven en la URL para que atrás, recargar y compartir funcionen. */
export interface FiltrosPedidos {
  numero: string;
  /** Parte del nombre de la ciudad de envío. */
  ciudad: string;
  /** Nombres completos de los vendedores del cliente; vacío para todos. */
  vendedores: string[];
  estadosIds: number[];
  /** Fecha de creación en FileMaker, 'yyyy-MM-dd' o vacío. */
  desde: string;
  hasta: string;
  soloAbiertos: boolean;
  soloAtrasados: boolean;
}

/** Parámetros de la URL (?numero=&ciudad=&vendedor=A&vendedor=B&estados=1,2&desde=&hasta=&abiertos=0&atrasados=1&pagina=&orden=campo,asc). */
export interface ParametrosPedidos {
  numero?: string;
  ciudad?: string;
  /** Se repite una vez por vendedor: los nombres pueden tener comas. */
  vendedor?: string | string[];
  estados?: string;
  desde?: string;
  hasta?: string;
  abiertos?: string;
  atrasados?: string;
}

export type CampoOrdenPedidos = 'numeroPedido' | 'fechaCreacionFm' | 'fechaEstimadaEntrega';
export interface OrdenPedidos {
  campo: CampoOrdenPedidos;
  direccion: 'asc' | 'desc';
}

const CAMPOS_ORDEN: readonly CampoOrdenPedidos[] = [
  'numeroPedido',
  'fechaCreacionFm',
  'fechaEstimadaEntrega',
];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Por defecto se ven los pedidos abiertos: los cerrados se consultan a propósito. */
export function leerFiltros(p: ParametrosPedidos): FiltrosPedidos {
  return {
    numero: p.numero?.trim() ?? '',
    ciudad: p.ciudad?.trim() ?? '',
    vendedores: [
      ...new Set(
        [p.vendedor ?? []]
          .flat()
          .map((v) => v.trim())
          .filter((v) => v.length > 0),
      ),
    ],
    estadosIds: (p.estados ?? '')
      .split(',')
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v > 0),
    desde: p.desde && FECHA.test(p.desde) ? p.desde : '',
    hasta: p.hasta && FECHA.test(p.hasta) ? p.hasta : '',
    soloAbiertos: p.abiertos !== '0',
    soloAtrasados: p.atrasados === '1',
  };
}

/** Solo se escribe en la URL lo que difiere del valor por defecto. Cambiar filtros vuelve a la primera página. */
export function aParametros(f: FiltrosPedidos, orden: OrdenPedidos | null): Params {
  return {
    numero: f.numero.trim() || null,
    ciudad: f.ciudad.trim() || null,
    vendedor: f.vendedores.length ? f.vendedores : null,
    estados: f.estadosIds.length ? f.estadosIds.join(',') : null,
    desde: f.desde || null,
    hasta: f.hasta || null,
    abiertos: f.soloAbiertos ? null : '0',
    atrasados: f.soloAtrasados ? '1' : null,
    pagina: null,
    orden: orden ? `${orden.campo},${orden.direccion}` : null,
  };
}

export function aFiltroApi(f: FiltrosPedidos): FiltroPedidoRequestDto {
  return {
    numeroPedido: f.numero || undefined,
    ciudad: f.ciudad || undefined,
    vendedores: f.vendedores.length ? f.vendedores : undefined,
    estadosIds: f.estadosIds.length ? f.estadosIds : undefined,
    fechaDesde: f.desde || undefined,
    fechaHasta: f.hasta || undefined,
    soloAbiertos: f.soloAbiertos || undefined,
    soloAtrasados: f.soloAtrasados || undefined,
  };
}

export function leerOrden(texto: string | undefined): OrdenPedidos | null {
  const [campo, direccion] = (texto ?? '').split(',');
  return CAMPOS_ORDEN.includes(campo as CampoOrdenPedidos) &&
    (direccion === 'asc' || direccion === 'desc')
    ? { campo: campo as CampoOrdenPedidos, direccion }
    : null;
}

export function leerPagina(texto: string | undefined): number {
  const pagina = Number(texto);
  return Number.isInteger(pagina) && pagina > 0 ? pagina : 0;
}
