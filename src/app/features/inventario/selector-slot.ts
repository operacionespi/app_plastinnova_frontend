import { Component, computed, inject, input, linkedSignal, model } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { CatalogoInventario } from './inventario';

/**
 * Bodega y slot de un movimiento: primero se elige la bodega y luego uno de sus slots. Los slots inactivos solo se
 * ofrecen como origen (de ellos puede salir lo que quede).
 */
@Component({
  selector: 'pi-selector-slot',
  imports: [MatFormFieldModule, MatSelectModule],
  template: `
    <fieldset>
      <legend>{{ etiqueta() }}</legend>
      <mat-form-field appearance="outline" class="bodega">
        <mat-label>Bodega</mat-label>
        <mat-select
          [value]="bodegaId()"
          [disabled]="deshabilitado()"
          (selectionChange)="elegirBodega($event.value)"
        >
          @for (b of catalogo.bodegas.value() ?? []; track b.id) {
            <mat-option [value]="b.id">{{ b.codigo }} · {{ b.descripcion }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="slot">
        <mat-label>Slot</mat-label>
        <mat-select
          [value]="slotId()"
          [disabled]="deshabilitado() || !bodegaId()"
          (selectionChange)="slotId.set($event.value)"
        >
          @for (s of opciones(); track s.id) {
            <mat-option [value]="s.id">
              {{ s.codigo }}{{ s.descripcion ? ' · ' + s.descripcion : ''
              }}{{ s.activo ? '' : ' (inactivo)' }}
            </mat-option>
          }
        </mat-select>
        @if (bodegaId() && !opciones().length) {
          <mat-hint>La bodega no tiene slots activos</mat-hint>
        }
      </mat-form-field>
    </fieldset>
  `,
  styles: `
    fieldset {
      display: flex;
      flex-wrap: wrap;
      gap: 0 12px;
      margin: 0;
      padding: 0;
      border: none;
    }
    legend {
      margin-bottom: 8px;
      font: var(--mat-sys-title-small);
    }
    .bodega {
      flex: 2 1 240px;
    }
    .slot {
      flex: 1 1 160px;
    }
  `,
})
export class SelectorSlot {
  protected readonly catalogo = inject(CatalogoInventario);

  readonly etiqueta = input.required<string>();
  /** true = se ofrecen también los slots inactivos (para sacar lo que quede en ellos). */
  readonly incluirInactivos = input(false);
  readonly deshabilitado = input(false);
  readonly slotId = model<number | null>(null);

  /**
   * Sigue al slot elegido (ej. al abrir con un slot ya indicado). Sin slot conserva la bodega que eligió el usuario,
   * que todavía no ha escogido slot.
   */
  protected readonly bodegaId = linkedSignal<number | null, number | null>({
    source: () => {
      const id = this.slotId();
      return this.catalogo.slots.value()?.find((s) => s.id === id)?.bodegaId ?? null;
    },
    computation: (bodega, anterior) => bodega ?? anterior?.value ?? null,
  });
  protected readonly opciones = computed(() =>
    (this.catalogo.slots.value() ?? []).filter(
      (s) => s.bodegaId === this.bodegaId() && (s.activo || this.incluirInactivos()),
    ),
  );

  protected elegirBodega(id: number): void {
    this.bodegaId.set(id);
    this.slotId.set(null);
  }
}
