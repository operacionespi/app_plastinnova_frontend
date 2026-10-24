import { computed, inject, Service } from '@angular/core';
import { Sesion } from '../auth/sesion';

export interface OpcionMenu {
  etiqueta: string;
  icono: string;
  ruta: string;
  permiso: string;
  /** Si se indica, además del permiso el usuario debe tener uno de estos roles. */
  roles?: readonly string[];
}

export const PERMISOS = {
  verPedidos: 'pedido:ver',
  cambiarEstadoPedido: 'pedido:cambiar-estado',
  fechaEntrega: 'pedido:fecha-entrega',
  reportarAvance: 'detalle:cambiar-estado',
  corregirCantidad: 'detalle:corregir-cantidad',
  noSale: 'detalle:no-sale',
  verIndicadores: 'kpi:ver',
  gestionarEstados: 'estado:gestionar',
  sincronizar: 'sync:ejecutar',
  gestionarUsuarios: 'usuario:gestionar',
  verMateriales: 'material:ver',
  cargarMateriales: 'material:cargar',
  verInventario: 'inventario:ver',
  moverInventario: 'inventario:mover',
  gestionarInventario: 'inventario:gestionar',
} as const;

/** Orden del menú. Las rutas también exigen el permiso (ver app.routes.ts). */
export const OPCIONES_MENU: readonly OpcionMenu[] = [
  {
    etiqueta: 'Pedidos',
    icono: 'list_alt',
    ruta: '/pedidos',
    permiso: PERMISOS.verPedidos,
    roles: ['ADMIN', 'COORDINADOR', 'SUPERVISOR', 'GERENCIA'],
  },
  {
    etiqueta: 'Cola de trabajo',
    icono: 'conveyor_belt',
    ruta: '/operador/cola',
    permiso: PERMISOS.reportarAvance,
  },
  // El resto de roles busca desde el listado de pedidos
  {
    etiqueta: 'Buscar pedido',
    icono: 'search',
    ruta: '/operador/buscar',
    permiso: PERMISOS.reportarAvance,
    roles: ['OPERADOR'],
  },
  {
    etiqueta: 'Tableros',
    icono: 'monitoring',
    ruta: '/gerencia/tablero',
    permiso: PERMISOS.verIndicadores,
  },
  {
    etiqueta: 'Lista de materiales',
    icono: 'schema',
    ruta: '/materiales',
    permiso: PERMISOS.verMateriales,
  },
  {
    etiqueta: 'Inventario',
    icono: 'inventory_2',
    ruta: '/inventario',
    permiso: PERMISOS.verInventario,
  },
  {
    etiqueta: 'Estados',
    icono: 'account_tree',
    ruta: '/configuracion/estados',
    permiso: PERMISOS.gestionarEstados,
  },
  {
    etiqueta: 'Sincronización',
    icono: 'sync',
    ruta: '/configuracion/sincronizacion',
    permiso: PERMISOS.sincronizar,
  },
  {
    etiqueta: 'Usuarios',
    icono: 'manage_accounts',
    ruta: '/configuracion/usuarios',
    permiso: PERMISOS.gestionarUsuarios,
  },
];

/** Pantalla de entrada por rol; los demás roles entran a la primera opción de su menú. */
const INICIO_POR_ROL: Record<string, string> = {
  OPERADOR: '/operador/cola',
  GERENCIA: '/gerencia/tablero',
};

export const NOMBRES_ROL: Record<string, string> = {
  ADMIN: 'Administrador',
  COORDINADOR: 'Coordinador',
  SUPERVISOR: 'Supervisor',
  OPERADOR: 'Operador',
  GERENCIA: 'Gerencia',
};

@Service()
export class Navegacion {
  private readonly sesion = inject(Sesion);

  readonly opciones = computed(() => {
    const roles = this.sesion.roles();
    return OPCIONES_MENU.filter(
      (o) => this.sesion.tienePermiso(o.permiso) && (!o.roles || o.roles.some((r) => roles.has(r))),
    );
  });

  /** Solo operadores: diseño para tablet (barra superior con botones grandes, sin menú lateral). */
  readonly modoTablet = computed(() => {
    const roles = this.sesion.roles();
    return roles.size === 1 && roles.has('OPERADOR');
  });

  readonly nombreRoles = computed(() =>
    [...this.sesion.roles()].map((r) => NOMBRES_ROL[r] ?? r).join(', '),
  );

  /**
   * Las redirecciones del router se evalúan antes que los guards: sin sesión se va directo al login,
   * así después de ingresar no se termina en una ruta calculada sin roles.
   */
  rutaInicio(): string {
    if (!this.sesion.autenticado()) {
      return '/login';
    }
    if (this.sesion.debeCambiarContrasena()) {
      return '/cuenta';
    }
    const roles = this.sesion.roles();
    const porRol = roles.size === 1 ? INICIO_POR_ROL[[...roles][0]] : undefined;
    return porRol ?? this.opciones()[0]?.ruta ?? '/cuenta';
  }
}
