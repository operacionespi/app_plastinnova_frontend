import { Component, input } from '@angular/core';
import { EstadoResponseDto } from '../../api/models/estado-response-dto';

/** Nombre del estado con su color del catálogo (el color es un apoyo: el texto siempre está). */
@Component({
  selector: 'pi-estado-chip',
  template: `
    <span
      class="punto"
      aria-hidden="true"
      [style.background-color]="estado()?.color ?? null"
    ></span>
    {{ estado()?.nombre ?? 'Sin estado' }}
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: var(--mat-sys-corner-full);
      background-color: var(--mat-sys-surface-container-high);
      font: var(--mat-sys-label-large);
      white-space: nowrap;
    }
    .punto {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: var(--mat-sys-outline);
    }
  `,
})
export class EstadoChip {
  readonly estado = input<EstadoResponseDto>();
}
