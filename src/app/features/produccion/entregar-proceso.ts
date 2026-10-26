import { DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, max, maxLength, min, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { ordenProduccionDarDeBaja } from '../../api/fn/ordenes-de-produccion/orden-produccion-dar-de-baja';
import { ordenProduccionEntregar } from '../../api/fn/ordenes-de-produccion/orden-produccion-entregar';
import { EstadoResponseDto } from '../../api/models/estado-response-dto';
import { OrdenProduccionDto } from '../../api/models/orden-produccion-dto';
import { ProductoOrdenDto } from '../../api/models/producto-orden-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';

export interface DatosEntrega {
  orden: OrdenProduccionDto;
  producto: ProductoOrdenDto;
  /** Proceso que entrega; si no viene, el más avanzado con piezas. */
  origenId?: number;
  /** true: dar de baja en lugar de entregar. */
  baja?: boolean;
}

interface Entrega {
  origenId: number | null;
  destinoId: number | null;
  cantidad: number | null;
  observaciones: string;
}

interface Destino {
  etapa: EstadoResponseDto;
  devolucion: boolean;
}

/**
 * Un proceso entrega piezas de un producto: al siguiente de la ruta (o a Almacén 1 desde el último, mostrando lo que se
 * consumirá) o, con el motivo, a uno anterior. En modo baja, las piezas se desechan con su motivo.
 */
@Component({
  selector: 'pi-entregar-proceso',
  imports: [
    DecimalPipe,
    FormField,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ datos.baja ? 'Dar de baja' : 'Entregar' }} {{ producto.itemCodigo }}
    </h2>
    <form (submit)="guardar($event)" novalidate>
      <mat-dialog-content>
        @if (error(); as mensaje) {
          <p class="mensaje-error" role="alert">{{ mensaje }}</p>
        }
        <p class="ayuda">
          {{ datos.orden.numero }} · {{ producto.itemDescripcion }}.
          @if (producto.lineas?.length) {
            Las líneas de pedido siguen a sus piezas.
          }
        </p>
        <fieldset class="grupo">
          <legend id="leyenda-origen">{{ datos.baja ? 'Piezas en' : 'Entrega' }}</legend>
          <mat-button-toggle-group
            aria-labelledby="leyenda-origen"
            [value]="modelo().origenId"
            (change)="elegirOrigen($event.value)"
          >
            @for (e of conPiezas(); track e.etapa?.id) {
              <mat-button-toggle [value]="e.etapa?.id">
                <span
                  class="punto"
                  aria-hidden="true"
                  [style.background-color]="e.etapa?.color ?? null"
                ></span>
                {{ e.etapa?.nombre }} ({{ e.cantidad | number }})
              </mat-button-toggle>
            }
          </mat-button-toggle-group>
        </fieldset>

        @if (!datos.baja) {
          <fieldset class="grupo">
            <legend id="leyenda-destino">Recibe</legend>
            <mat-button-toggle-group
              aria-labelledby="leyenda-destino"
              [value]="modelo().destinoId"
              (change)="elegirDestino($event.value)"
            >
              @for (d of destinos(); track d.etapa.id) {
                <mat-button-toggle [value]="d.etapa.id">
                  @if (d.devolucion) {
                    <mat-icon aria-hidden="true">undo</mat-icon>
                  }
                  {{ d.etapa.nombre }}
                </mat-button-toggle>
              }
            </mat-button-toggle-group>
            @if (devolucion()) {
              <p class="nota">Devolución a un proceso anterior: indique el motivo del rechazo.</p>
            }
          </fieldset>
        }

        <mat-form-field appearance="outline">
          <mat-label>Piezas</mat-label>
          <input matInput type="number" inputmode="numeric" [formField]="formulario.cantidad" />
          <mat-hint>De 1 a {{ disponibles() | number }}</mat-hint>
          @for (e of formulario.cantidad().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>

        @if (consume()) {
          <div class="recepcion" role="note">
            <p>
              <mat-icon aria-hidden="true">{{ datos.baja ? 'delete' : 'inventory_2' }}</mat-icon>
              @if (datos.baja) {
                Las piezas salen de la orden y se consumen sus componentes:
              } @else {
                Las piezas entran a {{ producto.bodegaDestino }}. Se consumen:
              }
            </p>
            <ul>
              @for (c of consumo(); track c.codigo) {
                <li [class.falta]="!c.alcanza">
                  <span class="codigo">{{ c.codigo }}</span>
                  {{ c.requerido | number: '1.0-6' }} {{ c.unidad }} de {{ c.bodega }} (libres
                  {{ c.libre | number: '1.0-6' }})
                  @if (!c.alcanza) {
                    · no alcanza
                  }
                </li>
              } @empty {
                <li>Nada: el ítem no tiene lista de materiales.</li>
              }
            </ul>
          </div>
        }

        <mat-form-field appearance="outline">
          <mat-label>{{ pideMotivo() ? 'Motivo' : 'Observaciones' }}</mat-label>
          <textarea matInput rows="2" [formField]="formulario.observaciones"></textarea>
          @for (e of formulario.observaciones().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit" [disabled]="formulario().submitting()">
          {{ datos.baja ? 'Dar de baja' : devolucion() ? 'Devolver' : 'Entregar' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: '../pedidos/dialogo-pedido.scss',
  styles: `
    .recepcion {
      padding: 8px 16px;
      border-radius: var(--mat-sys-corner-medium);
      background-color: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);

      p {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
      }
      ul {
        margin: 4px 0 0;
        padding-left: 32px;
      }
    }
    .nota {
      margin: 8px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .codigo {
      font-weight: 500;
    }
    .falta {
      color: var(--mat-sys-error);
      font-weight: 500;
    }
  `,
})
export class EntregarProceso {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<EntregarProceso, OrdenProduccionDto>);
  protected readonly datos = inject<DatosEntrega>(MAT_DIALOG_DATA);
  protected readonly producto = this.datos.producto;
  private readonly etapas = this.producto.etapas ?? [];
  protected readonly conPiezas = signal(this.etapas.filter((e) => (e.cantidad ?? 0) > 0));

  protected readonly modelo = signal<Entrega>(this.inicial());
  protected readonly disponibles = computed(
    () => this.etapas.find((e) => e.etapa?.id === this.modelo().origenId)?.cantidad ?? 0,
  );
  /** El siguiente proceso (o el almacén desde el último) y, como devolución, los anteriores. */
  protected readonly destinos = computed<Destino[]>(() => this.destinosDe(this.modelo().origenId));
  protected readonly devolucion = computed(
    () => this.destinos().find((d) => d.etapa.id === this.modelo().destinoId)?.devolucion ?? false,
  );
  protected readonly pideMotivo = computed(() => !!this.datos.baja || this.devolucion());
  protected readonly consume = computed(
    () => !!this.datos.baja || this.modelo().destinoId === this.datos.orden.etapaRecepcion?.id,
  );
  protected readonly formulario = form(this.modelo, (d) => {
    required(d.origenId, { message: 'Elija el proceso.' });
    required(d.cantidad, { message: 'Ingrese las piezas.' });
    min(d.cantidad, 1, { message: 'Deben ser más de cero.' });
    max(d.cantidad, () => this.disponibles(), {
      message: () => `En ese proceso hay ${this.disponibles()} piezas.`,
    });
    maxLength(d.observaciones, 500, { message: 'Máximo 500 caracteres.' });
    required(d.observaciones, {
      when: () => this.pideMotivo(),
      message: 'Indique el motivo.',
    });
  });
  protected readonly error = signal<string | null>(null);

  /** Lo que consumen las piezas indicadas, contra lo libre de cada componente. */
  protected readonly consumo = computed(() => {
    const piezas = this.modelo().cantidad ?? 0;
    return (this.producto.componentes ?? [])
      .filter((c) => c.bodega)
      .map((c) => {
        const requerido = (c.cantidadPorUnidad ?? 0) * piezas;
        return { ...c, requerido, alcanza: (c.libre ?? 0) >= requerido };
      });
  });

  protected elegirOrigen(id: number): void {
    const cantidad = this.etapas.find((e) => e.etapa?.id === id)?.cantidad ?? 0;
    this.modelo.update((m) => ({
      ...m,
      origenId: id,
      destinoId: this.destinosDe(id)[0]?.etapa.id ?? null,
      cantidad,
    }));
  }

  protected elegirDestino(id: number): void {
    this.modelo.update((m) => ({ ...m, destinoId: id }));
  }

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const m = this.modelo();
      const contexto = new HttpContext().set(MANEJA_ERRORES, true);
      const id = this.datos.orden.id ?? 0;
      const productoId = this.producto.id ?? 0;
      try {
        const orden = this.datos.baja
          ? await this.api.invoke(
              ordenProduccionDarDeBaja,
              {
                id,
                body: {
                  productoId,
                  etapaId: m.origenId ?? 0,
                  cantidad: m.cantidad ?? 0,
                  motivo: m.observaciones.trim(),
                },
              },
              contexto,
            )
          : await this.api.invoke(
              ordenProduccionEntregar,
              {
                id,
                body: {
                  productoId,
                  etapaOrigenId: m.origenId ?? 0,
                  etapaDestinoId: m.destinoId ?? 0,
                  cantidad: m.cantidad ?? 0,
                  observaciones: m.observaciones.trim() || undefined,
                },
              },
              contexto,
            );
        this.dialogo.close(orden);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }

  private inicial(): Entrega {
    const conPiezas = this.etapas.filter((e) => (e.cantidad ?? 0) > 0);
    const origen =
      conPiezas.find((e) => e.etapa?.id === this.datos.origenId) ?? conPiezas[conPiezas.length - 1];
    const origenId = origen?.etapa?.id ?? null;
    return {
      origenId,
      destinoId: this.destinosDe(origenId)[0]?.etapa.id ?? null,
      cantidad: origen?.cantidad ?? null,
      observaciones: '',
    };
  }

  private destinosDe(origenId: number | null): Destino[] {
    const indice = this.etapas.findIndex((e) => e.etapa?.id === origenId);
    if (indice < 0) {
      return [];
    }
    const siguiente =
      indice === this.etapas.length - 1
        ? this.datos.orden.etapaRecepcion
        : this.etapas[indice + 1].etapa;
    const anteriores = this.etapas
      .slice(0, indice)
      .reverse()
      .map((e) => ({ etapa: e.etapa ?? {}, devolucion: true }));
    return [...(siguiente ? [{ etapa: siguiente, devolucion: false }] : []), ...anteriores];
  }
}
