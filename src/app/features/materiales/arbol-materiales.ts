import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NodoMaterialDto } from '../../api/models/nodo-material-dto';

type TipoItem = NonNullable<NodoMaterialDto['tipo']>;

export const NOMBRE_TIPO: Record<TipoItem, string> = {
  PRODUCTO_TERMINADO: 'Producto terminado',
  SEMITERMINADO: 'Semiterminado',
  MATERIA_PRIMA: 'Materia prima',
};

export function nombreTipo(tipo?: TipoItem): string {
  return tipo ? NOMBRE_TIPO[tipo] : 'Sin maestro';
}

/**
 * Componentes de un ítem en varios niveles. Cada componente con sus propios componentes se abre y cierra con
 * <details> (accesible con teclado y lector de pantalla sin código adicional). Se dibuja a sí mismo por nivel.
 */
@Component({
  selector: 'pi-arbol-materiales',
  imports: [DecimalPipe, MatIconModule, NgTemplateOutlet],
  template: `
    <ul [class.raiz]="nivel() === 0">
      @for (n of nodos(); track n.codigo) {
        <li>
          @if (n.componentes?.length) {
            <details [open]="nivel() < abiertosHasta()">
              <summary>
                <mat-icon class="flecha" aria-hidden="true">chevron_right</mat-icon>
                <ng-container
                  [ngTemplateOutlet]="fila"
                  [ngTemplateOutletContext]="{ $implicit: n }"
                />
              </summary>
              <pi-arbol-materiales
                [nodos]="n.componentes ?? []"
                [nivel]="nivel() + 1"
                [abiertosHasta]="abiertosHasta()"
              />
            </details>
          } @else {
            <div class="hoja">
              <span></span>
              <ng-container
                [ngTemplateOutlet]="fila"
                [ngTemplateOutletContext]="{ $implicit: n }"
              />
            </div>
          }
        </li>
      }
    </ul>

    <ng-template #fila let-n>
      <span class="item">
        <span class="codigo">{{ n.codigo }}</span>
        <span class="descripcion">
          @if (n.enMaestro) {
            {{ n.descripcion || '—' }}
          } @else {
            <mat-icon class="sin-maestro" aria-hidden="true">help</mat-icon>
            No está en el maestro de ítems
          }
        </span>
      </span>
      <span class="tipo" [class]="'tipo ' + (n.tipo ?? 'SIN_TIPO')">{{ nombreTipo(n.tipo) }}</span>
      <span class="bodega" [attr.title]="'Bodega ' + n.bodega">{{ n.bodega }}</span>
      <span class="cantidad">
        {{ n.cantidad | number: '1.0-6' }} <span class="unidad">{{ n.unidad }}</span>
        @if (n.cantidadPorPadre !== undefined && n.cantidadPorPadre !== 1) {
          <span class="por-padre">({{ n.cantidadPorPadre | number: '1.0-6' }} c/u)</span>
        }
      </span>
    </ng-template>
  `,
  styles: `
    ul {
      margin: 0;
      padding-left: 20px;
      list-style: none;
      border-left: 1px solid var(--mat-sys-outline-variant);
    }
    ul.raiz {
      padding-left: 0;
      border-left: none;
    }
    summary,
    .hoja {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) auto 5rem 11rem;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 2px 8px;
      border-radius: var(--mat-sys-corner-small);
    }
    summary {
      cursor: pointer;
      list-style: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    .flecha {
      color: var(--mat-sys-on-surface-variant);
      transition: transform 150ms;
    }
    details[open] > summary .flecha {
      transform: rotate(90deg);
    }
    summary:hover,
    .hoja:hover {
      background-color: var(--mat-sys-surface-container);
    }
    summary:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: -2px;
    }
    .item {
      display: flex;
      flex-wrap: wrap;
      column-gap: 12px;
      min-width: 0;
    }
    .codigo {
      font-weight: 500;
      overflow-wrap: anywhere;
    }
    .descripcion {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-on-surface-variant);
    }
    .sin-maestro {
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--mat-sys-error);
    }
    .tipo {
      padding: 2px 8px;
      border-radius: var(--mat-sys-corner-full);
      background-color: var(--mat-sys-surface-container-high);
      font: var(--mat-sys-label-medium);
      white-space: nowrap;
    }
    .tipo.SEMITERMINADO {
      background-color: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .tipo.MATERIA_PRIMA {
      background-color: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .tipo.SIN_TIPO {
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .bodega {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .cantidad {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .unidad,
    .por-padre {
      color: var(--mat-sys-on-surface-variant);
    }
    .por-padre {
      display: block;
      font: var(--mat-sys-body-small);
    }
    @media (max-width: 720px) {
      summary,
      .hoja {
        grid-template-columns: 24px minmax(0, 1fr) auto;
      }
      .tipo,
      .bodega {
        display: none;
      }
    }
  `,
})
export class ArbolMateriales {
  readonly nodos = input.required<readonly NodoMaterialDto[]>();
  readonly nivel = input(0);
  /** Niveles que se muestran abiertos al inicio (0 = todos cerrados). */
  readonly abiertosHasta = input(1);

  protected readonly nombreTipo = nombreTipo;
}
