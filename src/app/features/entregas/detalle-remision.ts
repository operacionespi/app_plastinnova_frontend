import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, input, resource } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { remisionObtener } from '../../api/fn/entregas/remision-obtener';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { UtcPipe } from '../../core/ui/fechas';

/** Una remisión, lista para imprimir y firmar al entregar. */
@Component({
  selector: 'pi-detalle-remision',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
    UtcPipe,
  ],
  template: `
    @if (error(); as problema) {
      <div class="mensaje-error" role="alert">
        <span>{{ problema.estado === 404 ? 'La remisión no existe.' : problema.mensaje }}</span>
        @if (problema.estado !== 404) {
          <button matButton type="button" (click)="remision.reload()">Reintentar</button>
        }
      </div>
    } @else if (remision.hasValue()) {
      @let r = remision.value();
      <div class="barra no-imprimir">
        <a matButton [routerLink]="['/pedidos', r.pedidoId, 'entregas']">
          <mat-icon>arrow_back</mat-icon>
          Entregas del pedido
        </a>
        <span class="espacio"></span>
        <button matButton="filled" type="button" (click)="imprimir()">
          <mat-icon>print</mat-icon>
          Imprimir
        </button>
      </div>

      <article class="documento" [attr.aria-label]="'Remisión ' + r.numero">
        <header>
          <div>
            <p class="empresa">PlastInnova</p>
            <h1>Remisión {{ r.numero }}</h1>
          </div>
          @if (r.estado === 'ANULADA') {
            <p class="anulada" role="status">ANULADA</p>
          }
        </header>

        <dl>
          <div>
            <dt>Fecha</dt>
            <dd>{{ r.fecha | utc | date: 'd MMM y, h:mm a' }}</dd>
          </div>
          <div>
            <dt>Pedido</dt>
            <dd>{{ r.numeroPedido }}</dd>
          </div>
          <div class="ancho">
            <dt>Cliente</dt>
            <dd>{{ r.cliente }}</dd>
          </div>
          <div>
            <dt>Transportador</dt>
            <dd>{{ r.transportador ?? '—' }}</dd>
          </div>
          <div>
            <dt>Placa</dt>
            <dd>{{ r.placa ?? '—' }}</dd>
          </div>
        </dl>

        <table>
          <caption class="cdk-visually-hidden">
            Productos entregados
          </caption>
          <thead>
            <tr>
              <th scope="col">Pos.</th>
              <th scope="col">Producto</th>
              <th scope="col" class="numero">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            @for (l of r.lineas ?? []; track l.detalleId) {
              <tr>
                <td>{{ l.posicion ?? '—' }}</td>
                <td>
                  <span class="codigo">{{ l.productoSku }}</span> {{ l.descripcion }}
                </td>
                <td class="numero">{{ l.cantidad | number }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colspan="2">Total</th>
              <td class="numero">{{ r.totalPiezas | number }}</td>
            </tr>
          </tfoot>
        </table>

        @if (r.observaciones) {
          <p class="observaciones"><strong>Observaciones:</strong> {{ r.observaciones }}</p>
        }
        @if (r.estado === 'ANULADA') {
          <p class="observaciones">
            <strong>Anulada</strong> el {{ r.fechaAnulacion | utc | date: 'd MMM y, h:mm a' }} por
            {{ r.usuarioAnulacion }}: {{ r.motivoAnulacion }}
          </p>
        }

        <div class="firmas">
          <div>
            <span class="linea"></span>
            Entrega · {{ r.usuario }}
          </div>
          <div>
            <span class="linea"></span>
            Recibe (nombre, documento y fecha)
          </div>
        </div>
      </article>
    } @else {
      <mat-progress-bar mode="indeterminate" aria-label="Cargando la remisión" />
    }
  `,
  styles: `
    .barra {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: -8px 0 16px -12px;

      button {
        min-height: 48px;
      }
    }
    .espacio {
      flex: 1;
    }
    .documento {
      max-width: 840px;
      padding: 32px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
      background-color: var(--mat-sys-surface);
    }
    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
    }
    .empresa {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-title-medium);
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }
    .anulada {
      margin: 0;
      padding: 4px 12px;
      border: 2px solid var(--mat-sys-error);
      color: var(--mat-sys-error);
      font: var(--mat-sys-title-medium);
      letter-spacing: 2px;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px 24px;
      margin: 0 0 24px;

      .ancho {
        grid-column: 1 / -1;
      }
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    dd {
      margin: 2px 0 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 8px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      text-align: left;
    }
    tfoot th,
    tfoot td {
      border-bottom: 0;
      font-weight: 500;
    }
    .numero {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .codigo {
      font-weight: 500;
    }
    .observaciones {
      margin: 16px 0 0;
    }
    .firmas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      margin-top: 64px;

      div {
        display: flex;
        flex-direction: column;
        gap: 4px;
        color: var(--mat-sys-on-surface-variant);
      }
    }
    .linea {
      border-top: 1px solid var(--mat-sys-on-surface);
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
    @media print {
      .documento {
        max-width: none;
        padding: 0;
        border: 0;
      }
    }
  `,
})
export class DetalleRemision {
  private readonly api = inject(Api);

  /** Parámetro de la ruta. */
  readonly id = input.required<string>();

  protected readonly remision = resource({
    params: () => ({ id: Number(this.id()) }),
    loader: ({ params }) =>
      this.api.invoke(remisionObtener, params, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly error = computed(() =>
    this.remision.error() ? leerProblema(this.remision.error()) : null,
  );

  protected imprimir(): void {
    window.print();
  }
}
