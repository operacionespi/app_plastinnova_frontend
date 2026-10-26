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
import { HistorialOrdenDto } from '../../api/models/historial-orden-dto';
import { LineaOrdenDto } from '../../api/models/linea-orden-dto';
import { OrdenProduccionDto } from '../../api/models/orden-produccion-dto';
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
import { AvanzarOrden } from './avanzar-orden';
import { FormularioOrden } from './formulario-orden';
import { NOMBRE_ESTADO_ORDEN } from './produccion';
import { VincularLineas } from './vincular-lineas';

const NOMBRE_TIPO_HISTORIAL: Record<NonNullable<HistorialOrdenDto['tipo']>, string> = {
  CREACION: 'Creada',
  CAMBIO_ETAPA: 'Avance',
  EDICION: 'Edición',
  ANULACION: 'Anulada',
};

/** Una orden de producción: avance por etapas, líneas de pedido que atiende, materiales e historial. */
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
    avanzar: this.sesion.tienePermiso(PERMISOS.reportarAvance),
  };
  protected readonly nombreEstado = NOMBRE_ESTADO_ORDEN;
  protected readonly nombreHistorial = NOMBRE_TIPO_HISTORIAL;
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
  protected readonly lineasActivas = computed(() =>
    (this.orden.value()?.lineas ?? []).filter((l) => l.activa),
  );
  protected readonly faltanMateriales = computed(() =>
    (this.orden.value()?.componentes ?? []).some((c) => !c.alcanza),
  );
  protected readonly ocupado = signal(false);

  protected avanzar(o: OrdenProduccionDto): void {
    this.abrir(AvanzarOrden, o, (actualizada) =>
      actualizada.estado === 'TERMINADA'
        ? `${actualizada.numero} terminó: ${actualizada.cantidadProcesada} piezas entraron a ${actualizada.bodegaDestino}.`
        : `${actualizada.numero} pasó a ${actualizada.etapa?.nombre}.`,
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

  protected async desvincular(o: OrdenProduccionDto, l: LineaOrdenDto): Promise<void> {
    const confirmado = await firstValueFrom(
      this.dialogos
        .open<Confirmacion, DatosConfirmacion, boolean>(Confirmacion, {
          data: {
            titulo: 'Quitar la línea',
            mensaje: `La línea ${l.posicion} del pedido ${l.numeroPedido} deja de seguir a ${o.numero} y se reporta por separado desde ${l.estadoLinea?.nombre}.`,
            accion: 'Quitar',
          },
        })
        .afterClosed(),
    );
    if (!confirmado) {
      return;
    }
    this.ocupado.set(true);
    try {
      this.orden.set(
        await this.api.invoke(
          ordenProduccionDesvincular,
          { id: o.id ?? 0, detalleId: l.detalleId ?? 0 },
          new HttpContext().set(MANEJA_ERRORES, true),
        ),
      );
    } catch (e) {
      this.avisos.error(leerProblema(e).mensaje);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected anular(o: OrdenProduccionDto): void {
    this.dialogos
      .open<Justificacion, DatosJustificacion, OrdenProduccionDto>(Justificacion, {
        data: {
          titulo: `Anular ${o.numero}`,
          mensaje:
            'La orden no se podrá retomar. Las líneas que atiende quedan en su etapa y se reportan por separado.',
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

  private abrir<C>(
    componente: ComponentType<C>,
    o: OrdenProduccionDto,
    aviso: (o: OrdenProduccionDto) => string,
    sinCerrarPorFuera = false,
  ): void {
    this.dialogos
      .open<C, OrdenProduccionDto, OrdenProduccionDto>(componente, {
        data: o,
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
