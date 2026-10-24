import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { KpiPedidosPorEstadoDto } from '../../api/models/kpi-pedidos-por-estado-dto';

/**
 * Pedidos de cada estado con los filtros del listado. Cada tarjeta activa o quita su estado del filtro;
 * "Todos" quita el filtro de estados. El color del catálogo es un apoyo: el nombre siempre está.
 */
@Component({
  selector: 'pi-tarjetas-estado',
  imports: [DecimalPipe],
  template: `
    <button
      type="button"
      class="tarjeta"
      [attr.aria-pressed]="seleccionados().length === 0"
      (click)="todos.emit()"
    >
      <span class="cantidad">{{ total() | number }}</span>
      <span class="nombre">Todos</span>
    </button>
    @for (estado of conteos(); track estado.estadoId) {
      <button
        type="button"
        class="tarjeta"
        [class.vacia]="!estado.pedidos"
        [style.--color-estado]="estado.color ?? null"
        [attr.aria-pressed]="seleccionados().includes(estado.estadoId!)"
        (click)="alternar.emit(estado.estadoId!)"
      >
        <span class="cantidad">{{ estado.pedidos ?? 0 | number }}</span>
        <span class="nombre">{{ estado.nombre }}</span>
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .tarjeta {
      --color-estado: var(--mat-sys-outline);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      min-width: 128px;
      padding: 10px 16px 10px 14px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-left: 6px solid var(--color-estado);
      border-radius: var(--mat-sys-corner-medium);
      background-color: var(--mat-sys-surface-container-low);
      color: var(--mat-sys-on-surface);
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background-color 120ms;
    }
    .tarjeta:first-child {
      --color-estado: var(--mat-sys-primary);
    }
    .tarjeta:hover {
      background-color: var(--mat-sys-surface-container-high);
    }
    .tarjeta:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    .tarjeta[aria-pressed='true'] {
      border-color: var(--mat-sys-primary);
      border-left-color: var(--color-estado);
      background-color: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .cantidad {
      font: var(--mat-sys-headline-small);
    }
    .nombre {
      font: var(--mat-sys-label-large);
    }
    .vacia .cantidad {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  host: { role: 'group', 'aria-label': 'Pedidos por estado' },
})
export class TarjetasEstado {
  readonly conteos = input.required<KpiPedidosPorEstadoDto[]>();
  readonly seleccionados = input.required<number[]>();
  readonly alternar = output<number>();
  readonly todos = output<void>();

  protected readonly total = computed(() =>
    this.conteos().reduce((suma, estado) => suma + (estado.pedidos ?? 0), 0),
  );
}
