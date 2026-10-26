import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { remisionListar } from '../../api/fn/entregas/remision-listar';
import { RemisionDto } from '../../api/models/remision-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { UtcPipe } from '../../core/ui/fechas';
import { NOMBRE_ESTADO_REMISION } from './entregas';

const POR_PAGINA = 25;

/** Remisiones de todos los pedidos, de la más reciente. Se emiten desde las entregas de cada pedido. */
@Component({
  selector: 'pi-remisiones',
  imports: [
    DatePipe,
    DecimalPipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    RouterLink,
    UtcPipe,
  ],
  template: `
    <h1>Entregas</h1>
    <p class="ayuda">
      Remisiones emitidas. Para entregar, abra el pedido y use Entregas: ahí se ve lo disponible en
      la bodega para cada línea.
    </p>

    <form class="filtros" role="search" (submit)="buscar($event)" novalidate>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="texto">
        <mat-label>Remisión, pedido o cliente</mat-label>
        <input matInput type="search" autocomplete="off" [formField]="formulario.texto" />
      </mat-form-field>
      <button matButton="filled" type="submit">
        <mat-icon>search</mat-icon>
        Buscar
      </button>
    </form>

    @if (error(); as mensaje) {
      <div class="mensaje-error" role="alert">
        <span>{{ mensaje }}</span>
        <button matButton type="button" (click)="remisiones.reload()">Reintentar</button>
      </div>
    } @else if (remisiones.hasValue()) {
      @let pagina = remisiones.value();
      @if (pagina.content?.length) {
        <div class="tabla">
          <table mat-table [dataSource]="pagina.content ?? []" aria-label="Remisiones">
            <ng-container matColumnDef="numero">
              <th mat-header-cell *matHeaderCellDef>Remisión</th>
              <td mat-cell *matCellDef="let r">
                <a class="codigo enlace" [routerLink]="['/entregas', r.id]">{{ r.numero }}</a>
                <span class="secundario">{{ r.fecha | utc | date: 'd MMM y, h:mm a' }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="pedido">
              <th mat-header-cell *matHeaderCellDef>Pedido</th>
              <td mat-cell *matCellDef="let r">
                <a class="codigo enlace" [routerLink]="['/pedidos', r.pedidoId, 'entregas']">{{
                  r.numeroPedido
                }}</a>
                <span class="secundario">{{ r.cliente }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="piezas">
              <th mat-header-cell *matHeaderCellDef class="numero">Piezas</th>
              <td mat-cell *matCellDef="let r" class="numero">
                {{ r.totalPiezas | number }}
                <span class="secundario"
                  >{{ r.lineas?.length }} {{ r.lineas?.length === 1 ? 'línea' : 'líneas' }}</span
                >
              </td>
            </ng-container>
            <ng-container matColumnDef="transporte">
              <th mat-header-cell *matHeaderCellDef>Transporte</th>
              <td mat-cell *matCellDef="let r">
                {{ r.transportador ?? '—' }}
                @if (r.placa) {
                  <span class="secundario">{{ r.placa }}</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="estado">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let r">
                <span [class]="'estado ' + r.estado">{{ nombre(r) }}</span>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columnas"></tr>
            <tr mat-row *matRowDef="let fila; columns: columnas"></tr>
          </table>
        </div>
        @if ((pagina.page?.totalElements ?? 0) > (pagina.page?.size ?? 0)) {
          <mat-paginator
            [length]="pagina.page?.totalElements ?? 0"
            [pageIndex]="pagina.page?.number ?? 0"
            [pageSize]="pagina.page?.size ?? 25"
            [hidePageSize]="true"
            aria-label="Páginas de remisiones"
            (page)="numeroPagina.set($event.pageIndex)"
          />
        }
      } @else {
        <p class="vacio">
          {{
            filtro()
              ? 'No hay remisiones con ese filtro.'
              : 'Aún no se ha emitido ninguna remisión.'
          }}
        </p>
      }
    } @else {
      <mat-progress-bar mode="indeterminate" aria-label="Cargando remisiones" />
    }
  `,
  styleUrl: '../inventario/inventario-tablas.scss',
  styles: `
    :host {
      padding-top: 0;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }
    .ayuda {
      margin: 8px 0 16px;
      color: var(--mat-sys-on-surface-variant);
    }
    .enlace {
      color: var(--mat-sys-primary);
    }
    td .secundario {
      display: block;
    }
    .estado {
      padding: 2px 10px;
      border-radius: var(--mat-sys-corner-full);
      background-color: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font: var(--mat-sys-label-large);
      white-space: nowrap;

      &.ANULADA {
        background-color: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }
    }
  `,
})
export class Remisiones {
  private readonly api = inject(Api);

  protected readonly columnas = ['numero', 'pedido', 'piezas', 'transporte', 'estado'];
  protected readonly datos = signal({ texto: '' });
  protected readonly formulario = form(this.datos);
  protected readonly filtro = signal('');
  protected readonly numeroPagina = signal(0);

  protected readonly remisiones = resource({
    params: () => ({ texto: this.filtro(), pagina: this.numeroPagina(), tamano: POR_PAGINA }),
    loader: ({ params }) =>
      this.api.invoke(remisionListar, params, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly error = computed(() =>
    this.remisiones.error() ? leerProblema(this.remisiones.error()).mensaje : null,
  );

  protected buscar(evento: Event): void {
    evento.preventDefault();
    this.numeroPagina.set(0);
    this.filtro.set(this.datos().texto.trim());
  }

  protected nombre(r: RemisionDto): string {
    return NOMBRE_ESTADO_REMISION[r.estado ?? 'EMITIDA'];
  }
}
