import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../api/api';
import { inventarioExistencias } from '../../api/fn/inventario/inventario-existencias';
import { ExistenciaDto } from '../../api/models/existencia-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { UtcPipe } from '../../core/ui/fechas';
import { nombreTipo } from '../materiales/arbol-materiales';
import { CatalogoInventario, NOMBRE_TIPO_MOVIMIENTO, TipoMovimientoManual } from './inventario';

const POR_PAGINA = 25;

export interface AccionExistencia {
  tipo: TipoMovimientoManual;
  existencia: ExistenciaDto;
}

/** Saldos por ítem y slot (solo los mayores que cero), con acciones para mover lo que hay en cada fila. */
@Component({
  selector: 'pi-existencias',
  imports: [
    DatePipe,
    DecimalPipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    UtcPipe,
  ],
  template: `
    <form class="filtros compacto" role="search" (submit)="buscar($event)" novalidate>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="texto">
        <mat-label>Ítem (código o descripción)</mat-label>
        <input matInput type="search" autocomplete="off" [formField]="formulario.texto" />
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
      <button matButton="filled" type="submit">
        <mat-icon>search</mat-icon>
        Buscar
      </button>
    </form>

    @if (error(); as mensaje) {
      <div class="mensaje-error" role="alert">
        <span>{{ mensaje }}</span>
        <button matButton type="button" (click)="existencias.reload()">Reintentar</button>
      </div>
    } @else if (existencias.hasValue()) {
      @let pagina = existencias.value();
      @if (pagina.content?.length) {
        <div class="tabla">
          <table mat-table [dataSource]="pagina.content ?? []" aria-label="Existencias">
            <ng-container matColumnDef="item">
              <th mat-header-cell *matHeaderCellDef>Ítem</th>
              <td mat-cell *matCellDef="let e">
                <span class="codigo">{{ e.itemCodigo }}</span>
                <span class="secundario">{{ e.itemDescripcion }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="tipo">
              <th mat-header-cell *matHeaderCellDef>Tipo</th>
              <td mat-cell *matCellDef="let e">{{ textoTipo(e) }}</td>
            </ng-container>
            <ng-container matColumnDef="ubicacion">
              <th mat-header-cell *matHeaderCellDef>Bodega / slot</th>
              <td mat-cell *matCellDef="let e" class="ubicacion">
                {{ e.bodegaCodigo }} / {{ e.slotCodigo }}
              </td>
            </ng-container>
            <ng-container matColumnDef="cantidad">
              <th mat-header-cell *matHeaderCellDef class="numero">Cantidad</th>
              <td mat-cell *matCellDef="let e" class="numero">
                {{ e.cantidad | number: '1.0-6' }} <span class="secundario">{{ e.unidad }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="fecha">
              <th mat-header-cell *matHeaderCellDef>Último movimiento</th>
              <td mat-cell *matCellDef="let e">
                {{ e.fechaActualizacion | utc | date: 'd MMM y, h:mm a' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="acciones">
              <th mat-header-cell *matHeaderCellDef>
                <span class="cdk-visually-hidden">Acciones</span>
              </th>
              <td mat-cell *matCellDef="let e" class="acciones">
                @if (puedeMover()) {
                  <button
                    matIconButton
                    type="button"
                    [matMenuTriggerFor]="menu"
                    [attr.aria-label]="'Mover ' + e.itemCodigo + ' de ' + e.slotCodigo"
                  >
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #menu="matMenu">
                    @for (t of acciones; track t) {
                      <button
                        mat-menu-item
                        type="button"
                        (click)="mover.emit({ tipo: t, existencia: e })"
                      >
                        {{ nombreTipoMovimiento[t] }}
                      </button>
                    }
                  </mat-menu>
                }
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
            aria-label="Páginas de existencias"
            (page)="cambiarPagina($event)"
          />
        }
      } @else {
        <p class="vacio">
          No hay existencias{{ filtros().texto || filtros().bodegaId ? ' con esos filtros' : '' }}.
        </p>
      }
    } @else {
      <mat-progress-bar mode="indeterminate" aria-label="Cargando existencias" />
    }
  `,
  styleUrl: './inventario-tablas.scss',
})
export class Existencias {
  private readonly api = inject(Api);
  protected readonly catalogo = inject(CatalogoInventario);

  /** Cambia cuando se registra un movimiento: vuelve a consultar. */
  readonly version = input(0);
  readonly puedeMover = input(false);
  readonly mover = output<AccionExistencia>();

  protected readonly acciones: readonly TipoMovimientoManual[] = [
    'SALIDA',
    'TRASLADO',
    'AJUSTE',
    'ENTRADA',
  ];
  protected readonly nombreTipoMovimiento = NOMBRE_TIPO_MOVIMIENTO;
  protected readonly columnas = ['item', 'tipo', 'ubicacion', 'cantidad', 'fecha', 'acciones'];

  protected readonly datos = signal<{ texto: string; bodegaId: number | null }>({
    texto: '',
    bodegaId: null,
  });
  protected readonly formulario = form(this.datos);
  protected readonly filtros = signal({ texto: '', bodegaId: null as number | null });
  protected readonly pagina = signal(0);

  protected readonly existencias = resource({
    params: () => ({
      texto: this.filtros().texto,
      bodegaId: this.filtros().bodegaId ?? undefined,
      pagina: this.pagina(),
      tamano: POR_PAGINA,
      version: this.version(),
    }),
    loader: ({ params: { version, ...params } }) =>
      this.api.invoke(inventarioExistencias, params, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly error = computed(() =>
    this.existencias.error() ? leerProblema(this.existencias.error()).mensaje : null,
  );

  protected buscar(evento?: Event): void {
    evento?.preventDefault();
    this.pagina.set(0);
    this.filtros.set({ texto: this.datos().texto.trim(), bodegaId: this.datos().bodegaId });
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
  }

  // Las filas de mat-table no tienen tipo en la plantilla
  protected textoTipo(e: ExistenciaDto): string {
    return nombreTipo(e.tipo);
  }
}
