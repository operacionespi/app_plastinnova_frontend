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
import { ordenProduccionAvanzar } from '../../api/fn/ordenes-de-produccion/orden-produccion-avanzar';
import { OrdenProduccionDto } from '../../api/models/orden-produccion-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';

interface Reporte {
  etapaId: number | null;
  cantidad: number | null;
  observaciones: string;
}

/**
 * Reporta las piezas que pasan a la siguiente etapa. Si la etapa es la de almacén, muestra lo que se consumirá de
 * cada componente: el backend rechaza el reporte si alguno no alcanza.
 */
@Component({
  selector: 'pi-avanzar-orden',
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
    <h2 mat-dialog-title>Avance de {{ orden.numero }}</h2>
    <form (submit)="guardar($event)" novalidate>
      <mat-dialog-content>
        @if (error(); as mensaje) {
          <p class="mensaje-error" role="alert">{{ mensaje }}</p>
        }
        <p class="ayuda">
          {{ orden.itemCodigo }} · en {{ orden.etapa?.nombre }}.
          @if (orden.lineas?.length) {
            Las líneas de pedido que atiende pasan con ella.
          }
        </p>
        <fieldset class="grupo">
          <legend id="leyenda-etapa">Pasa a</legend>
          <mat-button-toggle-group
            aria-labelledby="leyenda-etapa"
            [value]="datos().etapaId"
            (change)="elegir($event.value)"
          >
            @for (e of orden.etapasSiguientes ?? []; track e.id) {
              <mat-button-toggle [value]="e.id">
                <span
                  class="punto"
                  aria-hidden="true"
                  [style.background-color]="e.color ?? null"
                ></span>
                {{ e.nombre }}
              </mat-button-toggle>
            }
          </mat-button-toggle-group>
          @if (formulario.etapaId().touched()) {
            @for (e of formulario.etapaId().errors(); track e.kind) {
              <p class="error-campo" role="alert">{{ e.message }}</p>
            }
          }
        </fieldset>

        <mat-form-field appearance="outline">
          <mat-label>Piezas que pasan</mat-label>
          <input matInput type="number" inputmode="numeric" [formField]="formulario.cantidad" />
          <mat-hint>De 1 a {{ limite }}</mat-hint>
          @for (e of formulario.cantidad().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>

        @if (esRecepcion()) {
          <div class="recepcion" role="note">
            <p>
              <mat-icon aria-hidden="true">inventory_2</mat-icon>
              Las piezas entran a {{ orden.bodegaDestino }} y la orden termina. Se consumen:
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
          <mat-label>Observaciones</mat-label>
          <textarea matInput rows="2" [formField]="formulario.observaciones"></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit" [disabled]="formulario().submitting()">
          Reportar
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
    .codigo {
      font-weight: 500;
    }
    .falta {
      color: var(--mat-sys-error);
      font-weight: 500;
    }
  `,
})
export class AvanzarOrden {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<AvanzarOrden, OrdenProduccionDto>);
  protected readonly orden = inject<OrdenProduccionDto>(MAT_DIALOG_DATA);
  protected readonly limite = this.orden.cantidadMaximaReportable ?? this.orden.cantidad ?? 0;

  protected readonly datos = signal<Reporte>({
    etapaId:
      this.orden.etapasSiguientes?.length === 1
        ? (this.orden.etapasSiguientes[0].id ?? null)
        : null,
    cantidad: this.limite,
    observaciones: '',
  });
  protected readonly formulario = form(this.datos, (d) => {
    required(d.etapaId, { message: 'Elija la etapa a la que pasa la orden.' });
    required(d.cantidad, { message: 'Ingrese las piezas.' });
    min(d.cantidad, 1, { message: 'Deben ser más de cero.' });
    max(d.cantidad, this.limite, {
      message: `No puede superar ${this.limite}: es lo que reportó la etapa anterior.`,
    });
    maxLength(d.observaciones, 500, { message: 'Máximo 500 caracteres.' });
  });
  protected readonly error = signal<string | null>(null);

  protected readonly esRecepcion = computed(() => {
    const etapa = this.orden.etapasSiguientes?.find((e) => e.id === this.datos().etapaId);
    return !!etapa && etapa.codigo === this.orden.etapaRecepcion;
  });
  /** Lo que consumen las piezas indicadas, contra lo libre de cada componente. */
  protected readonly consumo = computed(() => {
    const piezas = this.datos().cantidad ?? 0;
    return (this.orden.componentes ?? [])
      .filter((c) => c.bodega)
      .map((c) => {
        const requerido = (c.cantidadPorUnidad ?? 0) * piezas;
        return { ...c, requerido, alcanza: (c.libre ?? 0) >= requerido };
      });
  });

  protected elegir(id: number): void {
    this.datos.update((d) => ({ ...d, etapaId: id }));
  }

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const d = this.datos();
      try {
        const orden = await this.api.invoke(
          ordenProduccionAvanzar,
          {
            id: this.orden.id ?? 0,
            body: {
              etapaId: d.etapaId ?? 0,
              cantidad: d.cantidad ?? 0,
              observaciones: d.observaciones.trim() || undefined,
            },
          },
          new HttpContext().set(MANEJA_ERRORES, true),
        );
        this.dialogo.close(orden);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
