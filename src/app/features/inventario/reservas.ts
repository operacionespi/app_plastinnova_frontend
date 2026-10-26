import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { reservaInventarioListar } from '../../api/fn/reservas-de-inventario/reserva-inventario-listar';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { UtcPipe } from '../../core/ui/fechas';

const POR_PAGINA = 25;

/** Producto terminado comprometido por los pedidos, de la reserva más reciente a la más antigua. */
@Component({
  selector: 'pi-reservas',
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
    <form class="filtros" role="search" (submit)="buscar($event)" novalidate>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="texto">
        <mat-label>Ítem o número de pedido</mat-label>
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
        <button matButton type="button" (click)="reservas.reload()">Reintentar</button>
      </div>
    } @else if (reservas.hasValue()) {
      @let pagina = reservas.value();
      @if (pagina.content?.length) {
        <div class="tabla">
          <table
            mat-table
            [dataSource]="pagina.content ?? []"
            aria-label="Reservas de producto terminado"
          >
            <ng-container matColumnDef="pedido">
              <th mat-header-cell *matHeaderCellDef>Pedido</th>
              <td mat-cell *matCellDef="let r">
                <a class="codigo" [routerLink]="['/pedidos', r.pedidoId, 'materiales']">{{
                  r.numeroPedido
                }}</a>
                <span class="secundario">Línea {{ r.posicion ?? '—' }} · {{ r.estadoLinea }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="item">
              <th mat-header-cell *matHeaderCellDef>Ítem</th>
              <td mat-cell *matCellDef="let r">
                <span class="codigo">{{ r.itemCodigo }}</span>
                <span class="secundario">{{ r.itemDescripcion }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="bodega">
              <th mat-header-cell *matHeaderCellDef>Bodega</th>
              <td mat-cell *matCellDef="let r" class="ubicacion">{{ r.bodega }}</td>
            </ng-container>
            <ng-container matColumnDef="cantidad">
              <th mat-header-cell *matHeaderCellDef class="numero">Comprometido</th>
              <td mat-cell *matCellDef="let r" class="numero">
                {{ r.cantidad | number: '1.0-6' }} <span class="secundario">{{ r.unidad }}</span>
                <span class="secundario de">de {{ r.cantidadSolicitada | number }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="usuario">
              <th mat-header-cell *matHeaderCellDef>Comprometido por</th>
              <td mat-cell *matCellDef="let r">
                <span class="codigo">{{ r.usuario }}</span>
                <span class="secundario">{{ r.fecha | utc | date: 'd MMM y, h:mm a' }}</span>
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
            aria-label="Páginas de reservas"
            (page)="cambiarPagina($event)"
          />
        }
      } @else {
        <p class="vacio">
          {{
            filtro()
              ? 'No hay reservas con ese filtro.'
              : 'Ningún pedido tiene producto comprometido.'
          }}
        </p>
      }
    } @else {
      <mat-progress-bar mode="indeterminate" aria-label="Cargando reservas" />
    }
  `,
  styleUrl: './inventario-tablas.scss',
  styles: `
    .de {
      display: block;
      font: var(--mat-sys-body-small);
    }
  `,
})
export class Reservas {
  private readonly api = inject(Api);

  /** Cambia cuando se registra un movimiento: vuelve a consultar. */
  readonly version = input(0);

  protected readonly columnas = ['pedido', 'item', 'bodega', 'cantidad', 'usuario'];
  protected readonly datos = signal({ texto: '' });
  protected readonly formulario = form(this.datos);
  protected readonly filtro = signal('');
  protected readonly pagina = signal(0);

  protected readonly reservas = resource({
    params: () => ({
      texto: this.filtro(),
      pagina: this.pagina(),
      tamano: POR_PAGINA,
      version: this.version(),
    }),
    loader: ({ params: { version, ...params } }) =>
      this.api.invoke(reservaInventarioListar, params, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly error = computed(() =>
    this.reservas.error() ? leerProblema(this.reservas.error()).mensaje : null,
  );

  protected buscar(evento: Event): void {
    evento.preventDefault();
    this.pagina.set(0);
    this.filtro.set(this.datos().texto.trim());
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
  }
}
