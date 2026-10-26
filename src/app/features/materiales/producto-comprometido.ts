import { DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../api/api';
import { reservaInventarioComprometer } from '../../api/fn/reservas-de-inventario/reserva-inventario-comprometer';
import { reservaInventarioLiberar } from '../../api/fn/reservas-de-inventario/reserva-inventario-liberar';
import { reservaInventarioReservasPedido } from '../../api/fn/reservas-de-inventario/reserva-inventario-reservas-pedido';
import { ReservaLineaDto } from '../../api/models/reserva-linea-dto';
import { ReservasPedidoDto } from '../../api/models/reservas-pedido-dto';
import { Sesion } from '../../core/auth/sesion';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { Avisos } from '../../core/ui/avisos';
import { Confirmacion, DatosConfirmacion } from '../../core/ui/confirmacion';
import { DatosReservarLinea, ReservarLinea } from './reservar-linea';

type EstadoCompromiso = NonNullable<ReservasPedidoDto['estado']>;

export const NOMBRE_ESTADO_COMPROMISO: Record<EstadoCompromiso, string> = {
  SIN_COMPROMETER: 'Sin comprometer',
  PARCIAL: 'Comprometido en parte',
  COMPROMETIDO: 'Comprometido',
  NO_APLICA: 'Nada por comprometer',
};

/**
 * Producto terminado del pedido en la bodega de producto terminado: lo que cada línea tiene comprometido, lo que hay
 * y lo libre. Comprometer reserva lo libre para el pedido; lo producido entra ya comprometido para su línea. Al
 * entregarse con una remisión o facturarse el pedido, lo reservado sale de la bodega.
 */
@Component({
  selector: 'pi-producto-comprometido',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <div class="cabecera-seccion">
      <h2 id="titulo-comprometido">Producto terminado</h2>
      @if (reservas.value(); as r) {
        <span [class]="'estado ' + r.estado">{{ nombreEstado(r) }}</span>
      }
      <span class="espacio"></span>
      @if (puedeReservar && reservas.value(); as r) {
        @if (tieneReservas()) {
          <button matButton="outlined" type="button" [disabled]="ocupado()" (click)="liberar(r)">
            <mat-icon>lock_open</mat-icon>
            Liberar
          </button>
        }
        @if (r.estado === 'SIN_COMPROMETER' || r.estado === 'PARCIAL') {
          <button matButton="filled" type="button" [disabled]="ocupado()" (click)="comprometer()">
            <mat-icon>lock</mat-icon>
            Comprometer
          </button>
        }
      }
    </div>

    @if (error(); as mensaje) {
      <div class="mensaje-error" role="alert">
        <span>{{ mensaje }}</span>
        <button matButton type="button" (click)="reservas.reload()">Reintentar</button>
      </div>
    } @else if (reservas.value(); as r) {
      <p class="ayuda">
        Unidades de la bodega {{ r.bodega }} apartadas para este pedido. Libre es lo que hay en la
        bodega menos lo que tienen comprometido todos los pedidos. Lo producido entra a la bodega
        comprometido para su línea al llegar a Almacén 1. Las remisiones sacan primero lo
        comprometido; al facturar el pedido sale lo que quede.
      </p>
      @if (r.lineas?.length) {
        <div class="tabla">
          <table mat-table [dataSource]="r.lineas ?? []" aria-labelledby="titulo-comprometido">
            <ng-container matColumnDef="producto">
              <th mat-header-cell *matHeaderCellDef>Producto</th>
              <td mat-cell *matCellDef="let l">
                <span class="codigo">
                  <span class="posicion">{{ l.posicion ?? '—' }}</span> {{ l.productoSku }}
                </span>
                <span class="secundario">{{ l.descripcion }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="estado">
              <th mat-header-cell *matHeaderCellDef>Etapa</th>
              <td mat-cell *matCellDef="let l" class="nowrap">{{ l.estadoLinea }}</td>
            </ng-container>
            <ng-container matColumnDef="solicitada">
              <th mat-header-cell *matHeaderCellDef class="numero">Solicitado</th>
              <td mat-cell *matCellDef="let l" class="numero">
                {{ l.cantidadSolicitada | number }} <span class="secundario">{{ l.unidad }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="reservada">
              <th mat-header-cell *matHeaderCellDef class="numero">Comprometido</th>
              <td
                mat-cell
                *matCellDef="let l"
                class="numero"
                [class.completo]="completo(l)"
                [class.falta]="l.reservable && !completo(l)"
              >
                {{ l.reservada | number: '1.0-6' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="existencia">
              <th mat-header-cell *matHeaderCellDef class="numero">En bodega</th>
              <td mat-cell *matCellDef="let l" class="numero">
                {{ l.itemCodigo ? (l.existencia | number: '1.0-6') : '—' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="libre">
              <th mat-header-cell *matHeaderCellDef class="numero">Libre</th>
              <td mat-cell *matCellDef="let l" class="numero">
                {{ l.itemCodigo ? (l.libre | number: '1.0-6') : '—' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="acciones">
              <th mat-header-cell *matHeaderCellDef>
                <span class="cdk-visually-hidden">Acciones</span>
              </th>
              <td mat-cell *matCellDef="let l" class="acciones">
                @if (!l.reservable) {
                  <mat-icon
                    class="secundario"
                    role="img"
                    tabindex="0"
                    [matTooltip]="l.motivoNoReservable"
                    [attr.aria-label]="l.motivoNoReservable"
                    >info</mat-icon
                  >
                } @else if (puedeReservar) {
                  <!-- Sin nada libre ni reservado no hay qué cambiar; el tooltip dice por qué -->
                  <button
                    matIconButton
                    type="button"
                    disabledInteractive
                    [disabled]="ocupado() || !(l.maximoReservable || l.reservada)"
                    [attr.aria-label]="'Cambiar lo comprometido de ' + l.productoSku"
                    [matTooltip]="
                      l.maximoReservable || l.reservada
                        ? 'Cambiar lo comprometido'
                        : 'No hay ' + l.itemCodigo + ' libre en ' + r.bodega
                    "
                    (click)="cambiar(r, l)"
                  >
                    <mat-icon>edit</mat-icon>
                  </button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columnas"></tr>
            <tr mat-row *matRowDef="let fila; columns: columnas"></tr>
          </table>
        </div>
      } @else {
        <p class="vacio">El pedido no tiene líneas vigentes.</p>
      }
    } @else {
      <mat-progress-bar mode="indeterminate" aria-label="Cargando producto comprometido" />
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .cabecera-seccion {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 4px;
    }
    .cabecera-seccion button {
      min-height: 48px;
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-title-large);
    }
    .espacio {
      flex: 1;
    }
    .estado {
      padding: 2px 10px;
      border-radius: var(--mat-sys-corner-full);
      background-color: var(--mat-sys-surface-container-high);
      font: var(--mat-sys-label-large);
      white-space: nowrap;

      &.COMPROMETIDO {
        background-color: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }
      &.PARCIAL {
        background-color: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }
    }
    .ayuda {
      margin: 4px 0 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .tabla {
      overflow-x: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
    }
    table {
      width: 100%;
    }
    .codigo {
      display: block;
      font-weight: 500;
      white-space: nowrap;
    }
    .posicion,
    .secundario {
      color: var(--mat-sys-on-surface-variant);
    }
    .nowrap {
      white-space: nowrap;
    }
    .numero {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .completo {
      color: var(--mat-sys-primary);
      font-weight: 500;
    }
    .falta {
      color: var(--mat-sys-error);
      font-weight: 500;
    }
    .acciones {
      width: 48px;
      text-align: center;
    }
    .vacio {
      color: var(--mat-sys-on-surface-variant);
    }
    .mensaje-error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 8px 8px 16px;
      border-radius: var(--mat-sys-corner-medium);
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class ProductoComprometido {
  private readonly api = inject(Api);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);

  readonly pedidoId = input.required<number>();
  /** Cambiaron las reservas: los materiales del pedido se deben recalcular. */
  readonly cambio = output<void>();

  protected readonly puedeReservar = inject(Sesion).tienePermiso(PERMISOS.reservarInventario);
  protected readonly columnas = [
    'producto',
    'estado',
    'solicitada',
    'reservada',
    'existencia',
    'libre',
    'acciones',
  ];

  protected readonly reservas = resource({
    params: () => ({ id: this.pedidoId() }),
    loader: ({ params }) =>
      this.api.invoke(
        reservaInventarioReservasPedido,
        params,
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly error = computed(() =>
    this.reservas.error() ? leerProblema(this.reservas.error()).mensaje : null,
  );
  protected readonly tieneReservas = computed(() =>
    (this.reservas.value()?.lineas ?? []).some((l) => (l.reservada ?? 0) > 0),
  );
  protected readonly ocupado = signal(false);

  protected async comprometer(): Promise<void> {
    const antes = this.totalReservado();
    const r = await this.ejecutar(() =>
      this.api.invoke(
        reservaInventarioComprometer,
        { id: this.pedidoId() },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
    );
    if (r) {
      const nuevo = this.totalReservado() - antes;
      this.avisos.exito(
        nuevo > 0
          ? `Pedido ${r.numeroPedido}: ${NOMBRE_ESTADO_COMPROMISO[r.estado ?? 'PARCIAL'].toLowerCase()}.`
          : `No hay producto libre en ${r.bodega} para este pedido.`,
      );
    }
  }

  protected async liberar(r: ReservasPedidoDto): Promise<void> {
    const confirmado = await firstValueFrom(
      this.dialogos
        .open<Confirmacion, DatosConfirmacion, boolean>(Confirmacion, {
          data: {
            titulo: 'Liberar el pedido',
            mensaje: `Lo comprometido por el pedido ${r.numeroPedido} vuelve a quedar libre en ${r.bodega} para otros pedidos.`,
            accion: 'Liberar',
          },
        })
        .afterClosed(),
    );
    if (!confirmado) {
      return;
    }
    const liberado = await this.ejecutar(() =>
      this.api.invoke(
        reservaInventarioLiberar,
        { id: this.pedidoId() },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
    );
    if (liberado) {
      this.avisos.exito(`Se liberó lo comprometido por el pedido ${liberado.numeroPedido}.`);
    }
  }

  protected cambiar(r: ReservasPedidoDto, linea: ReservaLineaDto): void {
    this.dialogos
      .open<ReservarLinea, DatosReservarLinea, ReservasPedidoDto>(ReservarLinea, {
        data: { pedidoId: this.pedidoId(), bodega: r.bodega ?? '', linea },
        width: '480px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((actualizado) => {
        if (actualizado) {
          this.reservas.set(actualizado);
          this.cambio.emit();
        }
      });
  }

  // Las filas de mat-table no tienen tipo en la plantilla
  protected completo(l: ReservaLineaDto): boolean {
    return (l.reservada ?? 0) >= (l.cantidadSolicitada ?? 0) - (l.cantidadEntregada ?? 0);
  }

  protected nombreEstado(r: ReservasPedidoDto): string {
    return NOMBRE_ESTADO_COMPROMISO[r.estado ?? 'NO_APLICA'];
  }

  private totalReservado(): number {
    return (this.reservas.value()?.lineas ?? []).reduce((t, l) => t + (l.reservada ?? 0), 0);
  }

  private async ejecutar(
    accion: () => Promise<ReservasPedidoDto>,
  ): Promise<ReservasPedidoDto | null> {
    this.ocupado.set(true);
    try {
      const r = await accion();
      this.reservas.set(r);
      this.cambio.emit();
      return r;
    } catch (e) {
      this.avisos.error(leerProblema(e).mensaje);
      return null;
    } finally {
      this.ocupado.set(false);
    }
  }
}
