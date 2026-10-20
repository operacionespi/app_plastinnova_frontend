import { estadosDetalleActivar } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-activar';
import { estadosDetalleActualizar } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-actualizar';
import { estadosDetalleCrear } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-crear';
import { estadosDetalleCrearTransicion } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-crear-transicion';
import { estadosDetalleEliminar } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-eliminar';
import { estadosDetalleEliminarTransicion } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-eliminar-transicion';
import { estadosDetalleListar } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-listar';
import { estadosDetalleListarTransiciones } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-listar-transiciones';
import { estadosPedidoActivar } from '../../api/fn/catalogo-estados-de-pedido/estados-pedido-activar';
import { estadosPedidoActualizar } from '../../api/fn/catalogo-estados-de-pedido/estados-pedido-actualizar';
import { estadosPedidoCrear } from '../../api/fn/catalogo-estados-de-pedido/estados-pedido-crear';
import { estadosPedidoCrearTransicion } from '../../api/fn/catalogo-estados-de-pedido/estados-pedido-crear-transicion';
import { estadosPedidoEliminar } from '../../api/fn/catalogo-estados-de-pedido/estados-pedido-eliminar';
import { estadosPedidoEliminarTransicion } from '../../api/fn/catalogo-estados-de-pedido/estados-pedido-eliminar-transicion';
import { estadosPedidoListar } from '../../api/fn/catalogo-estados-de-pedido/estados-pedido-listar';
import { estadosPedidoListarTransiciones } from '../../api/fn/catalogo-estados-de-pedido/estados-pedido-listar-transiciones';

/** Los dos catálogos (pedido y línea) tienen la misma API; la pantalla trabaja con cualquiera de los dos. */
export const API_ESTADOS = {
  pedido: {
    listar: estadosPedidoListar,
    crear: estadosPedidoCrear,
    actualizar: estadosPedidoActualizar,
    activar: estadosPedidoActivar,
    eliminar: estadosPedidoEliminar,
    listarTransiciones: estadosPedidoListarTransiciones,
    crearTransicion: estadosPedidoCrearTransicion,
    eliminarTransicion: estadosPedidoEliminarTransicion,
  },
  detalle: {
    listar: estadosDetalleListar,
    crear: estadosDetalleCrear,
    actualizar: estadosDetalleActualizar,
    activar: estadosDetalleActivar,
    eliminar: estadosDetalleEliminar,
    listarTransiciones: estadosDetalleListarTransiciones,
    crearTransicion: estadosDetalleCrearTransicion,
    eliminarTransicion: estadosDetalleEliminarTransicion,
  },
};

export type TipoCatalogo = keyof typeof API_ESTADOS;

/** Igual que el backend: "En ensamble" → "EN_ENSAMBLE" (sin tildes, mayúsculas, separado por "_"). */
export function codigoDesdeNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}
