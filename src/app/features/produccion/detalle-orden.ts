import { ComponentType } from '@angular/cdk/portal';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../api/api';
import { ordenProduccionAnular } from '../../api/fn/ordenes-de-produccion/orden-produccion-anular';
import { ordenProduccionDesvincular } from '../../api/fn/ordenes-de-produccion/orden-produccion-desvincular';
import { ordenProduccionObtener } from '../../api/fn/ordenes-de-produccion/orden-produccion-obtener';
import { ordenProduccionQuitarProducto } from '../../api/fn/ordenes-de-produccion/orden-produccion-quitar-producto';
import { HistorialOrdenDto } from '../../api/models/historial-orden-dto';
import { LineaOrdenDto } from '../../api/models/linea-orden-dto';
import { OrdenProduccionDto } from '../../api/models/orden-produccion-dto';
import { ProductoOrdenDto } from '../../api/models/producto-orden-dto';
import { Sesion } from '../../core/auth/sesion';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { Avisos } from '../../core/ui/avisos';
import { Confirmacion, DatosConfirmacion } from '../../core/ui/confirmacion';
import { EstadoChip } from '../../core/ui/estado-chip';
import { DiaPipe, UtcPipe } from '../../core/ui/fechas';
import { DatosJustificacion, Justificacion } from '../../core/ui/justificacion';
import { NOMBRE_TIPO_MOVIMIENTO } from '../inventario/inventario';
import { DatosEntrega, EntregarProceso } from './entregar-proceso';
import { FormularioOrden } from './formulario-orden';
import { DatosProducto, FormularioProducto } from './formulario-producto';
import { NOMBRE_ESTADO_ORDEN, NOMBRE_TIPO_ENTREGA } from './produccion';
import { VincularLineas } from './vincular-lineas';

const NOMBRE_TIPO_HISTORIAL: Record<NonNullable<HistorialOrdenDto['tipo']>, string> = {
  CREACION: 'Creada',
  CAMBIO_ETAPA: 'Avance',
  EDICION: 'Edición',
  ANULACION: 'Anulada',
};

/**
 * Una orden de producción: por cada producto, las piezas en cada proceso de su ruta (con las entregas entre procesos),
 * las líneas de pedido que atiende y sus materiales; además, las entregas, los movimientos y el historial.
 */
@Component({
  selector: 'pi-detalle-orden',
  imports: [
    DatePipe,
    DecimalPipe,
    DiaPipe,
    EstadoChip,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
    RouterLink,
    UtcPipe,
  ],
  templateUrl: './detalle-orden.html',
  styleUrl: './detalle-orden.scss',
})
export class DetalleOrden {
  private readonly api = inject(Api);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  private readonly sesion = inject(Sesion);

  /** Parámetro de la ruta. */
  readonly id = input.required<string>();

  protected readonly puede = {
    gestionar: this.sesion.tienePermiso(PERMISOS.gestionarProduccion),
    entregar: this.sesion.tienePermiso(PERMISOS.reportarAvance),
  };
  protected readonly nombreEstado = NOMBRE_ESTADO_ORDEN;
  protected readonly nombreHistorial = NOMBRE_TIPO_HISTORIAL;
  protected readonly nombreEntrega = NOMBRE_TIPO_ENTREGA;
  protected readonly nombreMovimiento = NOMBRE_TIPO_MOVIMIENTO;
  protected readonly columnasLineas = ['pedido', 'etapa', 'cantidad', 'entrega', 'acciones'];
  protected readonly columnasComponentes = [
    'componente',
    'bodega',
    'porUnidad',
    'requerido',
    'libre',
  ];

  protected readonly orden = resource({
    params: () => ({ id: Number(this.id()) }),
    loader: ({ params }) =>
      this.api.invoke(ordenProduccionObtener, params, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly error = computed(() =>
    this.orden.error() ? leerProblema(this.orden.error()) : null,
  );
  protected readonly enProceso = computed(() =>
    (this.orden.value()?.productos ?? []).some((p) => !p.terminado),
  );
  protected readonly ocupado = signal(false);

  protected faltanMateriales(p: ProductoOrdenDto): boolean {
    return (p.componentes ?? []).some((c) => !c.alcanza);
  }

  protected entregar(o: OrdenProduccionDto, p: ProductoOrdenDto, origenId?: number): void {
    this.abrir<EntregarProceso, DatosEntrega>(
      EntregarProceso,
      { orden: o, producto: p, origenId },
      (actualizada) =>
        actualizada.estado === 'TERMINADA'
          ? `${actualizada.numero} terminó: todo llegó al almacén.`
          : `Entrega de ${p.itemCodigo} registrada.`,
    );
  }

  protected darDeBaja(o: OrdenProduccionDto, p: ProductoOrdenDto): void {
    this.abrir<EntregarProceso, DatosEntrega>(
      EntregarProceso,
      { orden: o, producto: p, baja: true },
      () => `Baja de ${p.itemCodigo} registrada.`,
    );
  }

  protected cambiarCantidad(o: OrdenProduccionDto, p: ProductoOrdenDto): void {
    this.abrir<FormularioProducto, DatosProducto>(
      FormularioProducto,
      { orden: o, producto: p },
      () => `Cantidad de ${p.itemCodigo} actualizada.`,
    );
  }

  protected agregarProducto(o: OrdenProduccionDto): void {
    this.abrir<FormularioProducto, DatosProducto>(
      FormularioProducto,
      { orden: o },
      (actualizada) => `${actualizada.numero}: producto agregado.`,
    );
  }

  protected editar(o: OrdenProduccionDto): void {
    this.abrir(FormularioOrden, o, (actualizada) => `${actualizada.numero} actualizada.`);
  }

  protected asignarLineas(o: OrdenProduccionDto): void {
    this.abrir(
      VincularLineas,
      o,
      (actualizada) => `${actualizada.numero}: líneas asignadas.`,
      true,
    );
  }

  protected async quitarProducto(o: OrdenProduccionDto, p: ProductoOrdenDto): Promise<void> {
    await this.confirmarYEjecutar(
      {
        titulo: `Quitar ${p.itemCodigo}`,
        mensaje: `${o.numero} deja de producir ${p.itemCodigo}.`,
        accion: 'Quitar',
      },
      () =>
        this.api.invoke(
          ordenProduccionQuitarProducto,
          { id: o.id ?? 0, productoId: p.id ?? 0 },
          new HttpContext().set(MANEJA_ERRORES, true),
        ),
    );
  }

  protected async desvincular(o: OrdenProduccionDto, l: LineaOrdenDto): Promise<void> {
    await this.confirmarYEjecutar(
      {
        titulo: 'Quitar la línea',
        mensaje: `La línea ${l.posicion} del pedido ${l.numeroPedido} deja de seguir a ${o.numero} y se reporta por separado desde ${l.estadoLinea?.nombre}.`,
        accion: 'Quitar',
      },
      () =>
        this.api.invoke(
          ordenProduccionDesvincular,
          { id: o.id ?? 0, detalleId: l.detalleId ?? 0 },
          new HttpContext().set(MANEJA_ERRORES, true),
        ),
    );
  }

  protected anular(o: OrdenProduccionDto): void {
    this.dialogos
      .open<Justificacion, DatosJustificacion, OrdenProduccionDto>(Justificacion, {
        data: {
          titulo: `Anular ${o.numero}`,
          mensaje:
            'La orden no se podrá retomar. Las piezas en proceso salen de la orden, lo que llegó al almacén sigue en el inventario y las líneas que atiende quedan en su etapa.',
          accion: 'Anular orden',
          ejecutar: (justificacion) =>
            this.api.invoke(
              ordenProduccionAnular,
              { id: o.id ?? 0, body: { justificacion } },
              new HttpContext().set(MANEJA_ERRORES, true),
            ),
        },
        width: '520px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((anulada) => {
        if (anulada) {
          this.orden.set(anulada);
          this.avisos.exito(`${anulada.numero} anulada.`);
        }
      });
  }

  private async confirmarYEjecutar(
    datos: DatosConfirmacion,
    accion: () => Promise<OrdenProduccionDto>,
  ): Promise<void> {
    const confirmado = await firstValueFrom(
      this.dialogos
        .open<Confirmacion, DatosConfirmacion, boolean>(Confirmacion, { data: datos })
        .afterClosed(),
    );
    if (!confirmado) {
      return;
    }
    this.ocupado.set(true);
    try {
      this.orden.set(await accion());
    } catch (e) {
      this.avisos.error(leerProblema(e).mensaje);
    } finally {
      this.ocupado.set(false);
    }
  }

  private abrir<C, D = OrdenProduccionDto>(
    componente: ComponentType<C>,
    datos: D,
    aviso: (o: OrdenProduccionDto) => string,
    sinCerrarPorFuera = false,
  ): void {
    this.dialogos
      .open<C, D, OrdenProduccionDto>(componente, {
        data: datos,
        width: '600px',
        maxWidth: '95vw',
        disableClose: sinCerrarPorFuera,
      })
      .afterClosed()
      .subscribe((actualizada) => {
        if (actualizada) {
          this.orden.set(actualizada);
          this.avisos.exito(aviso(actualizada));
        }
      });
  }
}
