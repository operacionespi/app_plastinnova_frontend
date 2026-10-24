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
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../api/api';
import { inventarioMovimientos } from '../../api/fn/inventario/inventario-movimientos';
import { MovimientoDto } from '../../api/models/movimiento-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { UtcPipe } from '../../core/ui/fechas';
import { CatalogoInventario, NOMBRE_TIPO_MOVIMIENTO, TipoMovimiento } from './inventario';

const POR_PAGINA = 25;

interface Filtros {
  itemCodigo: string;
  bodegaId: number | null;
  tipo: TipoMovimiento | null;
}

/** Bitácora de movimientos, del más reciente al más antiguo. */
@Component({
  selector: 'pi-movimientos',
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
    MatSelectModule,
    MatTableModule,
    UtcPipe,
  ],
  template: `
    <form class="filtros compacto" role="search" (submit)="buscar($event)" novalidate>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="texto">
        <mat-label>Código del ítem</mat-label>
        <input matInput type="search" autocomplete="off" [formField]="formulario.itemCodigo" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="bodega">
        <mat-label>Bodega</mat-label>
        <mat-select [formField]="formulario.bodegaId" (selectionChange)="buscar()">
          <mat-option [value]="null">Todas</mat-option>
          @for (b of catalogo.bodegas.value() ?? []; track b.id) {
            <mat-option [value]="b.id">{{ b.codigo }} · {{ b.descripcion }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="tipo">
        <mat-label>Tipo</mat-label>
        <mat-select [formField]="formulario.tipo" (selectionChange)="buscar()">
          <mat-option [value]="null">Todos</mat-option>
          @for (t of tipos; track t) {
            <mat-option [value]="t">{{ nombreTipo[t] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <button matButton="filled" type="submit">
        <mat-icon>search</mat-icon>
        Buscar
      </button>
    </form>

    @if (error(); as mensaje) {
      <div class="mensaje-error" role="alert">
        <span>{{ mensaje }}</span>
        <button matButton type="button" (click)="movimientos.reload()">Reintentar</button>
      </div>
    } @else if (movimientos.hasValue()) {
      @let pagina = movimientos.value();
      @if (pagina.content?.length) {
        <div class="tabla">
          <table
            mat-table
            [dataSource]="pagina.content ?? []"
            aria-label="Movimientos de inventario"
          >
            <ng-container matColumnDef="fecha">
              <th mat-header-cell *matHeaderCellDef>Fecha</th>
              <td mat-cell *matCellDef="let m" class="ubicacion">
                {{ m.fecha | utc | date: 'd MMM y, h:mm a' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="tipo">
              <th mat-header-cell *matHeaderCellDef>Tipo</th>
              <td mat-cell *matCellDef="let m">{{ textoTipo(m) }}</td>
            </ng-container>
            <ng-container matColumnDef="item">
              <th mat-header-cell *matHeaderCellDef>Ítem</th>
              <td mat-cell *matCellDef="let m">
                <span class="codigo">{{ m.itemCodigo }}</span>
                <span class="secundario">{{ m.itemDescripcion }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="origen">
              <th mat-header-cell *matHeaderCellDef>Sale de</th>
              <td mat-cell *matCellDef="let m" class="ubicacion">{{ m.origen ?? '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="destino">
              <th mat-header-cell *matHeaderCellDef>Entra a</th>
              <td mat-cell *matCellDef="let m" class="ubicacion">{{ m.destino ?? '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="cantidad">
              <th mat-header-cell *matHeaderCellDef class="numero">Cantidad</th>
              <td mat-cell *matCellDef="let m" class="numero">
                {{ m.cantidad | number: '1.0-6' }} <span class="secundario">{{ m.unidad }}</span>
                @if (m.cantidadContada !== undefined && m.cantidadContada !== null) {
                  <span class="secundario contado"
                    >Contado: {{ m.cantidadContada | number: '1.0-6' }}</span
                  >
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="detalle">
              <th mat-header-cell *matHeaderCellDef>Usuario y motivo</th>
              <td mat-cell *matCellDef="let m">
                <span class="codigo">{{ m.usuario }}</span>
                <span class="secundario">{{ textoMotivo(m) }}</span>
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
            aria-label="Páginas de movimientos"
            (page)="cambiarPagina($event)"
          />
        }
      } @else {
        <p class="vacio">No hay movimientos con esos filtros.</p>
      }
    } @else {
      <mat-progress-bar mode="indeterminate" aria-label="Cargando movimientos" />
    }
  `,
  styleUrl: './inventario-tablas.scss',
  styles: `
    .contado {
      display: block;
      font: var(--mat-sys-body-small);
    }
  `,
})
export class Movimientos {
  private readonly api = inject(Api);
  protected readonly catalogo = inject(CatalogoInventario);

  /** Cambia cuando se registra un movimiento: vuelve a consultar. */
  readonly version = input(0);

  protected readonly tipos = Object.keys(NOMBRE_TIPO_MOVIMIENTO) as TipoMovimiento[];
  protected readonly nombreTipo = NOMBRE_TIPO_MOVIMIENTO;
  protected readonly columnas = [
    'fecha',
    'tipo',
    'item',
    'origen',
    'destino',
    'cantidad',
    'detalle',
  ];

  protected readonly datos = signal<Filtros>({ itemCodigo: '', bodegaId: null, tipo: null });
  protected readonly formulario = form(this.datos);
  protected readonly filtros = signal<Filtros>({ itemCodigo: '', bodegaId: null, tipo: null });
  protected readonly pagina = signal(0);

  protected readonly movimientos = resource({
    params: () => ({
      itemCodigo: this.filtros().itemCodigo,
      bodegaId: this.filtros().bodegaId ?? undefined,
      tipo: this.filtros().tipo ?? undefined,
      pagina: this.pagina(),
      tamano: POR_PAGINA,
      version: this.version(),
    }),
    loader: ({ params: { version, ...params } }) =>
      this.api.invoke(inventarioMovimientos, params, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly error = computed(() =>
    this.movimientos.error() ? leerProblema(this.movimientos.error()).mensaje : null,
  );

  protected buscar(evento?: Event): void {
    evento?.preventDefault();
    this.pagina.set(0);
    this.filtros.set({ ...this.datos(), itemCodigo: this.datos().itemCodigo.trim() });
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
  }

  // Las filas de mat-table no tienen tipo en la plantilla
  protected textoTipo(m: MovimientoDto): string {
    return m.tipo ? NOMBRE_TIPO_MOVIMIENTO[m.tipo] : '—';
  }

  protected textoMotivo(m: MovimientoDto): string {
    return [m.motivo, m.observaciones].filter(Boolean).join(' · ');
  }
}
