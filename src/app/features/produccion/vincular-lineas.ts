import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Api } from '../../api/api';
import { ordenProduccionCandidatas } from '../../api/fn/ordenes-de-produccion/orden-produccion-candidatas';
import { ordenProduccionVincular } from '../../api/fn/ordenes-de-produccion/orden-produccion-vincular';
import { LineaOrdenDto } from '../../api/models/linea-orden-dto';
import { OrdenProduccionDto } from '../../api/models/orden-produccion-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { EstadoChip } from '../../core/ui/estado-chip';
import { DiaPipe } from '../../core/ui/fechas';

/**
 * Líneas de pedidos abiertos que piden alguno de los productos en proceso de la orden y aún no tienen quién las
 * produzca. Cada una se asigna con sus piezas (sin pasar de lo que el producto tiene en proceso sin asignar); al
 * cerrar devuelve la orden actualizada (o nada si no se asignó ninguna).
 */
@Component({
  selector: 'pi-vincular-lineas',
  imports: [
    DatePipe,
    DecimalPipe,
    DiaPipe,
    EstadoChip,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  template: `
    <h2 mat-dialog-title>Líneas para {{ orden().numero }}</h2>
    <mat-dialog-content>
      <p class="ayuda">
        Piezas en proceso sin asignar:
        @for (p of enProceso(); track p.id; let ultimo = $last) {
          <strong>{{ p.itemCodigo }}</strong> {{ p.porAsignar | number }}{{ ultimo ? '.' : ',' }}
        }
        Cada línea muestra lo que le falta sin contar lo comprometido ni lo entregado.
      </p>
      @if (error(); as mensaje) {
        <p class="mensaje-error" role="alert">{{ mensaje }}</p>
      }
      @if (candidatas.isLoading() && !candidatas.hasValue()) {
        <mat-progress-bar mode="indeterminate" aria-label="Buscando líneas" />
      } @else {
        <ul class="lineas">
          @for (l of candidatas.value() ?? []; track l.detalleId) {
            <li>
              <div class="datos">
                <span class="codigo">Pedido {{ l.numeroPedido }} · línea {{ l.posicion }}</span>
                <span>{{ l.itemCodigo }}</span>
                <span class="secundario">{{ l.cliente }}</span>
                <span class="secundario">
                  Le faltan {{ l.cantidad | number }} de {{ l.cantidadSolicitada | number }}
                  @if (l.fechaEstimadaEntrega) {
                    · entrega {{ l.fechaEstimadaEntrega | dia | date: 'd MMM' }}
                  }
                </span>
                <pi-estado-chip [estado]="l.estadoLinea" />
              </div>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="cantidad">
                <mat-label>Piezas</mat-label>
                <input
                  matInput
                  type="number"
                  inputmode="numeric"
                  min="1"
                  [max]="maximo(l)"
                  [value]="maximo(l)"
                  #piezas
                  [attr.aria-label]="
                    'Piezas para la línea ' + l.posicion + ' del pedido ' + l.numeroPedido
                  "
                />
              </mat-form-field>
              <button
                matButton="tonal"
                type="button"
                [disabled]="ocupado() || maximo(l) === 0"
                (click)="asignar(l, piezas.valueAsNumber)"
              >
                Asignar
              </button>
            </li>
          } @empty {
            <li class="vacio">No hay líneas pendientes sin orden de estos productos.</li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="filled" type="button" (click)="cerrar()">Listo</button>
    </mat-dialog-actions>
  `,
  styles: `
    .ayuda {
      margin: 0 0 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .lineas {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
    }
    .datos {
      display: flex;
      flex: 1 1 220px;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }
    .codigo {
      font-weight: 500;
    }
    .secundario,
    .vacio {
      color: var(--mat-sys-on-surface-variant);
    }
    .cantidad {
      width: 120px;
    }
    li button,
    mat-dialog-actions button {
      min-height: 48px;
    }
    .mensaje-error {
      margin: 0 0 12px;
      padding: 12px 16px;
      border-radius: var(--mat-sys-corner-medium);
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class VincularLineas {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<VincularLineas, OrdenProduccionDto>);

  protected readonly orden = signal(inject<OrdenProduccionDto>(MAT_DIALOG_DATA));
  /** Sube con cada asignación: las candidatas se vuelven a consultar. */
  private readonly version = signal(0);
  protected readonly enProceso = computed(() =>
    (this.orden().productos ?? []).filter((p) => !p.terminado),
  );
  protected readonly candidatas = resource({
    params: () => ({ id: this.orden().id ?? 0, version: this.version() }),
    loader: ({ params: { id } }) =>
      this.api.invoke(
        ordenProduccionCandidatas,
        { id },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  private cambio = false;

  protected maximo(l: LineaOrdenDto): number {
    const producto = this.enProceso().find((p) => p.itemCodigo === l.itemCodigo);
    return Math.max(Math.min(l.cantidad ?? 0, producto?.porAsignar ?? 0), 0);
  }

  protected async asignar(l: LineaOrdenDto, piezas: number): Promise<void> {
    this.error.set(null);
    if (!Number.isInteger(piezas) || piezas < 1 || piezas > this.maximo(l)) {
      this.error.set(`Indique entre 1 y ${this.maximo(l)} piezas para la línea ${l.posicion}.`);
      return;
    }
    this.ocupado.set(true);
    try {
      const orden = await this.api.invoke(
        ordenProduccionVincular,
        { id: this.orden().id ?? 0, body: { detalleId: l.detalleId ?? 0, cantidad: piezas } },
        new HttpContext().set(MANEJA_ERRORES, true),
      );
      this.orden.set(orden);
      this.cambio = true;
      this.version.update((v) => v + 1);
    } catch (e) {
      this.error.set(leerProblema(e).mensaje);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected cerrar(): void {
    this.dialogo.close(this.cambio ? this.orden() : undefined);
  }
}
