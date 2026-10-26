import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { estadosDetalleListar } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-listar';
import { ordenProduccionListar } from '../../api/fn/ordenes-de-produccion/orden-produccion-listar';
import { OrdenProduccionResumenDto } from '../../api/models/orden-produccion-resumen-dto';
import { Sesion } from '../../core/auth/sesion';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { DiaPipe, UtcPipe } from '../../core/ui/fechas';
import { EstadoOrden, NOMBRE_ESTADO_ORDEN } from './produccion';

const POR_PAGINA = 25;

interface Filtros {
  texto: string;
  estado: EstadoOrden | null;
  etapaId: number | null;
}

/** Órdenes de producción, de la más reciente; por defecto solo las abiertas. */
@Component({
  selector: 'pi-ordenes-produccion',
  imports: [
    DatePipe,
    DecimalPipe,
    DiaPipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    RouterLink,
    UtcPipe,
  ],
  template: `
    <div class="cabecera">
      <h1>Órdenes de producción</h1>
      <span class="espacio"></span>
      <a matButton="outlined" routerLink="/produccion/rutas">
        <mat-icon>route</mat-icon>
        Rutas
      </a>
      @if (puedeGestionar) {
        <a matButton="filled" routerLink="/produccion/nueva">
          <mat-icon>add</mat-icon>
          Nueva orden
        </a>
      }
    </div>
    <p class="ayuda">
      Cada orden produce uno o más productos. Sus piezas pasan de un proceso al siguiente con
      entregas parciales, según la ruta de cada producto, y las líneas de pedido siguen a sus
      piezas. Al llegar a Almacén 1 se consumen los materiales y lo producido queda comprometido
      para esas líneas.
    </p>

    <form class="filtros" role="search" (submit)="buscar($event)" novalidate>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="texto">
        <mat-label>Orden, ítem o pedido</mat-label>
        <input matInput type="search" autocomplete="off" [formField]="formulario.texto" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="tipo">
        <mat-label>Estado</mat-label>
        <mat-select [formField]="formulario.estado" (selectionChange)="buscar()">
          <mat-option [value]="null">Todas</mat-option>
          @for (e of estados; track e) {
            <mat-option [value]="e">{{ nombreEstado[e] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="tipo">
        <mat-label>Con piezas en</mat-label>
        <mat-select [formField]="formulario.etapaId" (selectionChange)="buscar()">
          <mat-option [value]="null">Todas</mat-option>
          @for (e of etapas.value() ?? []; track e.id) {
            <mat-option [value]="e.id">{{ e.nombre }}</mat-option>
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
        <button matButton type="button" (click)="ordenes.reload()">Reintentar</button>
      </div>
    } @else if (ordenes.hasValue()) {
      @let pagina = ordenes.value();
      @if (pagina.content?.length) {
        <div class="tabla">
          <table mat-table [dataSource]="pagina.content ?? []" aria-label="Órdenes de producción">
            <ng-container matColumnDef="numero">
              <th mat-header-cell *matHeaderCellDef>Orden</th>
              <td mat-cell *matCellDef="let o">
                <a class="codigo" [routerLink]="['/produccion', o.id]">{{ o.numero }}</a>
                <span class="secundario">{{ o.fechaCreacion | utc | date: 'd MMM y' }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="productos">
              <th mat-header-cell *matHeaderCellDef>Productos</th>
              <td mat-cell *matCellDef="let o">
                @for (p of o.productos; track p.itemCodigo; let i = $index) {
                  @if (i < 2) {
                    <span class="codigo">{{ p.itemCodigo }}</span>
                  }
                }
                @if (o.productos.length > 2) {
                  <span class="secundario">y {{ o.productos.length - 2 }} más</span>
                } @else if (o.productos.length === 1) {
                  <span class="secundario">{{ o.productos[0].itemDescripcion }}</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="cantidad">
              <th mat-header-cell *matHeaderCellDef class="numero">En almacén</th>
              <td mat-cell *matCellDef="let o" class="numero">
                {{ o.cantidadRecibida | number }} / {{ o.cantidad | number }}
              </td>
            </ng-container>
            <ng-container matColumnDef="etapa">
              <th mat-header-cell *matHeaderCellDef>En proceso</th>
              <td mat-cell *matCellDef="let o">
                @if (o.estado === 'ABIERTA') {
                  <div class="procesos">
                    @for (e of o.enProceso; track e.etapa.id) {
                      <span class="proceso">
                        <span
                          class="punto"
                          aria-hidden="true"
                          [style.background-color]="e.etapa.color ?? null"
                        ></span>
                        {{ e.etapa.nombre }} <strong>{{ e.cantidad | number }}</strong>
                      </span>
                    } @empty {
                      <span class="secundario">Sin piezas en proceso</span>
                    }
                  </div>
                } @else {
                  <span class="secundario">{{ nombreDe(o) }}</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="pedidos">
              <th mat-header-cell *matHeaderCellDef>Pedidos</th>
              <td mat-cell *matCellDef="let o">
                {{ o.pedidos?.length ? o.pedidos.join(', ') : 'Para inventario' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="fecha">
              <th mat-header-cell *matHeaderCellDef>Requerida</th>
              <td mat-cell *matCellDef="let o" class="ubicacion">
                {{ o.fechaRequerida ? (o.fechaRequerida | dia | date: 'd MMM y') : '—' }}
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
            aria-label="Páginas de órdenes"
            (page)="numeroPagina.set($event.pageIndex)"
          />
        }
      } @else {
        <p class="vacio">No hay órdenes con esos filtros.</p>
      }
    } @else {
      <mat-progress-bar mode="indeterminate" aria-label="Cargando órdenes" />
    }
  `,
  styleUrl: '../inventario/inventario-tablas.scss',
  styles: `
    :host {
      padding-top: 0;
    }
    .cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    .cabecera a {
      min-height: 48px;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }
    .espacio {
      flex: 1;
    }
    .ayuda {
      margin: 8px 0 16px;
      color: var(--mat-sys-on-surface-variant);
    }
    a.codigo {
      color: var(--mat-sys-primary);
    }
    .procesos {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
    }
    .proceso {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .punto {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: var(--mat-sys-outline);
    }
    td .secundario {
      display: block;
    }
  `,
})
export class OrdenesProduccion {
  private readonly api = inject(Api);

  protected readonly puedeGestionar = inject(Sesion).tienePermiso(PERMISOS.gestionarProduccion);
  protected readonly columnas = ['numero', 'productos', 'cantidad', 'etapa', 'pedidos', 'fecha'];
  protected readonly estados: EstadoOrden[] = ['ABIERTA', 'TERMINADA', 'ANULADA'];
  protected readonly nombreEstado = NOMBRE_ESTADO_ORDEN;

  protected readonly datos = signal<Filtros>({ texto: '', estado: 'ABIERTA', etapaId: null });
  protected readonly formulario = form(this.datos);
  protected readonly filtros = signal<Filtros>(this.datos());
  protected readonly numeroPagina = signal(0);

  protected readonly etapas = resource({
    loader: () =>
      this.api.invoke(estadosDetalleListar, {}, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly ordenes = resource({
    params: () => ({ ...this.filtros(), pagina: this.numeroPagina(), tamano: POR_PAGINA }),
    loader: ({ params: { texto, estado, etapaId, pagina, tamano } }) =>
      this.api.invoke(
        ordenProduccionListar,
        { texto, estado: estado ?? undefined, etapaId: etapaId ?? undefined, pagina, tamano },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly error = computed(() =>
    this.ordenes.error() ? leerProblema(this.ordenes.error()).mensaje : null,
  );

  protected buscar(evento?: Event): void {
    evento?.preventDefault();
    this.numeroPagina.set(0);
    this.filtros.set({ ...this.datos(), texto: this.datos().texto.trim() });
  }

  // Las filas de mat-table no tienen tipo en la plantilla
  protected nombreDe(o: OrdenProduccionResumenDto): string {
    return NOMBRE_ESTADO_ORDEN[o.estado ?? 'ABIERTA'];
  }
}
