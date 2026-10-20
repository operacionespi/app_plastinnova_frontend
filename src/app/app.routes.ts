import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import {
  autenticadoGuard,
  contrasenaTemporalGuard,
  invitadoGuard,
  permisoGuard,
} from './core/auth/guards';
import { Navegacion, PERMISOS } from './core/navegacion/navegacion';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Ingresar',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [autenticadoGuard],
    canActivateChild: [contrasenaTemporalGuard, permisoGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: () => inject(Navegacion).rutaInicio() },
      // Operador (tablet)
      {
        path: 'operador/cola',
        title: 'Cola de trabajo',
        loadComponent: () => import('./features/operador/cola-trabajo').then((m) => m.ColaTrabajo),
        data: { permiso: PERMISOS.reportarAvance },
      },
      {
        path: 'operador/buscar',
        title: 'Buscar pedido',
        loadComponent: () =>
          import('./features/operador/buscar-pedido').then((m) => m.BuscarPedido),
        data: { permiso: PERMISOS.reportarAvance },
      },
      {
        path: 'pedidos',
        title: 'Pedidos',
        loadComponent: () =>
          import('./features/pedidos/listado-pedidos').then((m) => m.ListadoPedidos),
        data: { permiso: PERMISOS.verPedidos },
      },
      {
        path: 'pedidos/:id',
        title: 'Detalle del pedido',
        loadComponent: () =>
          import('./features/pedidos/detalle-pedido').then((m) => m.DetallePedido),
        data: { permiso: PERMISOS.verPedidos },
      },
      {
        path: 'configuracion/estados',
        title: 'Estados',
        loadComponent: () =>
          import('./features/configuracion/configuracion-estados').then(
            (m) => m.ConfiguracionEstados,
          ),
        data: { permiso: PERMISOS.gestionarEstados },
      },
      {
        path: 'configuracion/sincronizacion',
        title: 'Sincronización',
        loadComponent: () =>
          import('./features/configuracion/sincronizacion').then((m) => m.Sincronizacion),
        data: { permiso: PERMISOS.sincronizar },
      },
      {
        path: 'configuracion/usuarios',
        title: 'Usuarios',
        loadComponent: () =>
          import('./features/usuarios/gestion-usuarios').then((m) => m.GestionUsuarios),
        data: { permiso: PERMISOS.gestionarUsuarios },
      },
      {
        path: 'gerencia/tablero',
        title: 'Tableros',
        loadComponent: () => import('./features/gerencia/tablero').then((m) => m.Tablero),
        data: { permiso: PERMISOS.verIndicadores },
      },
      {
        path: 'cuenta',
        title: 'Cambiar contraseña',
        loadComponent: () =>
          import('./features/cuenta/cambiar-contrasena').then((m) => m.CambiarContrasena),
      },
      {
        path: 'sin-acceso',
        title: 'Sin acceso',
        loadComponent: () => import('./features/errores/sin-acceso').then((m) => m.SinAcceso),
      },
      {
        path: '**',
        title: 'Página no encontrada',
        loadComponent: () => import('./features/errores/no-encontrada').then((m) => m.NoEncontrada),
      },
    ],
  },
];
