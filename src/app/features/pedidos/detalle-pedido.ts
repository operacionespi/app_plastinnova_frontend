import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, input, resource } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { estadosDetalleListar } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-listar';
import { MovimientoNoSaleResponseDto } from '../../api/models/movimiento-no-sale-response-dto';
import { pedidoObtenerHistorial } from '../../api/fn/pedidos-agregado-raiz/pedido-obtener-historial';
import { pedidoObtenerPedido } from '../../api/fn/pedidos-agregado-raiz/pedido-obtener-pedido';
import { LineaColaDto } from '../../api/models/linea-cola-dto';
import { PedidoDetalleResponseDto } from '../../api/models/pedido-detalle-response-dto';
import { PedidoResponseDto } from '../../api/models/pedido-response-dto';
import { Sesion } from '../../core/auth/sesion';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { Avisos } from '../../core/ui/avisos';
import { EstadoChip } from '../../core/ui/estado-chip';
import { DiaPipe, UtcPipe } from '../../core/ui/fechas';
import { CorregirCantidad } from '../operador/corregir-cantidad';
import { CODIGO_NO_SALE, DatosNoSale, mensajeNoSale, NoSale } from '../operador/no-sale';
import { HistorialLinea } from '../operador/historial-linea';
import { ReportarAvance } from '../operador/reportar-avance';
import { CambiarEstadoPedido } from './cambiar-estado-pedido';
import { FechaEntrega } from './fecha-entrega';
import { UltimoListado } from './ultimo-listado';

/** Las acciones sobre líneas reutilizan los diálogos de la tablet, que trabajan con la fila de la cola. */
export function lineaDelPedido(p: PedidoResponseDto, d: PedidoDetalleResponseDto): LineaColaDto {
  return {
    id: d.id,
    pedidoId: p.id,
    numeroPedido: p.numeroPedido,
    clienteRazonSocial: p.clienteRazonSocial,
    posicion: d.posicion,
    productoSku: d.productoSku,
    productoNombre: d.productoNombre,
    estadoActual: d.estadoActual,
    cantidadSolicitada: d.cantidadSolicitada,
    cantidadProcesada: d.cantidadProcesada,
    cantidadMaximaReporte: d.cantidadMaximaReporte,
    avanceReportado: d.avanceReportado,
    tipoAlistamiento: d.tipoAlistamiento,
    esAnexo: d.esAnexo,
    fechaCreacionFm: d.fechaCreacionFm,
    fechaEstimadaEntrega: p.fechaEstimadaEntrega,
    atrasado: p.atrasado,
  };
}

/** Coordinación: datos del pedido, su estado y fecha de entrega, sus líneas y el historial de cambios. */
@Component({
  selector: 'pi-detalle-pedido',
  imports: [
    DatePipe,
    DecimalPipe,
    DiaPipe,
    EstadoChip,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTableModule,
    RouterLink,
    UtcPipe,
  ],
  templateUrl: './detalle-pedido.html',
  styleUrl: './detalle-pedido.scss',
})
export class DetallePedido {
  private readonly api = inject(Api);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  private readonly ultimoListado = inject(UltimoListado).url;
  /** La URL guardada incluye los filtros (?numero=...): como UrlTree para que routerLink no los codifique como ruta. */
  protected readonly volver = computed(() => this.router.parseUrl(this.ultimoListado()));

  /** Parámetro de la ruta /pedidos/:id. */
  readonly id = input.required<string>();

  protected readonly pedido = resource({
    params: () => ({ id: Number(this.id()) }),
    loader: ({ params }) =>
      this.api.invoke(pedidoObtenerPedido, params, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly historial = resource({
    params: () => ({ id: Number(this.id()) }),
    loader: ({ params }) =>
      this.api.invoke(pedidoObtenerHistorial, params, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly error = computed(() =>
    this.pedido.error() ? leerProblema(this.pedido.error()) : null,
  );

  protected readonly puede = {
    cambiarEstado: this.sesion.tienePermiso(PERMISOS.cambiarEstadoPedido),
    fechaEntrega: this.sesion.tienePermiso(PERMISOS.fechaEntrega),
    reportarAvance: this.sesion.tienePermiso(PERMISOS.reportarAvance),
    corregirCantidad: this.sesion.tienePermiso(PERMISOS.corregirCantidad),
    noSale: this.sesion.tienePermiso(PERMISOS.noSale),
  };
  protected readonly codigoNoSale = CODIGO_NO_SALE;

  /** Etapas finales (Entregado, No sale): para no ofrecer No sale en una línea que ya terminó. */
  private readonly etapas = resource({
    params: () => (this.puede.noSale ? {} : undefined),
    loader: () =>
      this.api.invoke(
        estadosDetalleListar,
        { incluirInactivos: true },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  private readonly etapasFinales = computed(
    () => new Set((this.etapas.value() ?? []).filter((e) => e.esFinal).map((e) => e.id)),
  );

  protected puedeMarcarNoSale(p: PedidoResponseDto, d: PedidoDetalleResponseDto): boolean {
    return (
      this.puede.noSale &&
      this.etapas.hasValue() &&
      !this.etapasFinales().has(d.estadoActual?.id) &&
      !p.fechaCierre &&
      !d.eliminadoEnFm &&
      !p.eliminadoEnFm
    );
  }

  /** Un pedido anulado se reabre al devolver una línea; otro cerrado (ej. facturado) ya no admite cambios. */
  protected puedeDevolver(p: PedidoResponseDto, d: PedidoDetalleResponseDto): boolean {
    return (
      this.puede.noSale &&
      d.estadoActual?.codigo === CODIGO_NO_SALE &&
      (!p.fechaCierre || p.estadoActual?.codigo === 'ANULADO') &&
      !d.eliminadoEnFm &&
      !p.eliminadoEnFm
    );
  }

  protected readonly totales = computed(() => {
    const activas = (this.pedido.value()?.detalles ?? []).filter((d) => !d.eliminadoEnFm);
    return {
      lineas: activas.length,
      solicitadas: activas.reduce((t, d) => t + (d.cantidadSolicitada ?? 0), 0),
      procesadas: activas.reduce((t, d) => t + (d.cantidadProcesada ?? 0), 0),
    };
  });

  protected readonly columnas = [
    'posicion',
    'producto',
    'alistamiento',
    'estado',
    'avance',
    'acciones',
  ];

  protected cambiarEstado(p: PedidoResponseDto): void {
    this.abrir(
      CambiarEstadoPedido,
      p,
      (r: PedidoResponseDto) => `Pedido ${p.numeroPedido}: pasó a ${r.estadoActual?.nombre}.`,
    );
  }

  protected cambiarFechaEntrega(p: PedidoResponseDto): void {
    this.abrir(FechaEntrega, p, () => `Pedido ${p.numeroPedido}: fecha de entrega actualizada.`);
  }

  protected reportar(p: PedidoResponseDto, d: PedidoDetalleResponseDto): void {
    this.abrir(
      ReportarAvance,
      lineaDelPedido(p, d),
      (r: PedidoDetalleResponseDto) => `Pos. ${d.posicion}: pasó a ${r.estadoActual?.nombre}.`,
    );
  }

  protected corregir(p: PedidoResponseDto, d: PedidoDetalleResponseDto): void {
    this.abrir(
      CorregirCantidad,
      lineaDelPedido(p, d),
      (r: PedidoDetalleResponseDto) =>
        `Pos. ${d.posicion}: piezas corregidas a ${r.cantidadProcesada}.`,
    );
  }

  protected noSale(
    p: PedidoResponseDto,
    d: PedidoDetalleResponseDto,
    accion: DatosNoSale['accion'],
  ): void {
    const datos: DatosNoSale = { linea: lineaDelPedido(p, d), accion };
    this.abrir(NoSale, datos, (r: MovimientoNoSaleResponseDto) => mensajeNoSale(datos, r));
  }

  protected verHistorialLinea(p: PedidoResponseDto, d: PedidoDetalleResponseDto): void {
    this.dialogos.open(HistorialLinea, {
      data: lineaDelPedido(p, d),
      width: '640px',
      maxWidth: '95vw',
    });
  }

  protected porcentaje(procesadas = 0, solicitadas = 0): number {
    return solicitadas > 0 ? Math.min(100, (procesadas / solicitadas) * 100) : 0;
  }

  /** Abre un diálogo de edición; al cerrar recarga el pedido y su historial (también tras un conflicto). */
  private abrir<D, R>(
    componente: new (...args: never[]) => unknown,
    data: D,
    mensaje: (resultado: R) => string,
  ): void {
    this.dialogos
      .open<unknown, D, R>(componente, {
        data,
        width: '640px',
        maxWidth: '95vw',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .subscribe((resultado) => {
        if (resultado) {
          this.avisos.exito(mensaje(resultado));
        }
        this.pedido.reload();
        this.historial.reload();
      });
  }
}
