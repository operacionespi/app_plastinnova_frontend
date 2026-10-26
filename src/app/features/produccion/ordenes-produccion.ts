import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { estadosDetalleListar } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-listar';
import { ordenProduccionListar } from '../../api/fn/ordenes-de-produccion/orden-produccion-listar';
import { OrdenProduccionDto } from '../../api/models/orden-produccion-dto';
import { OrdenProduccionResumenDto } from '../../api/models/orden-produccion-resumen-dto';
import { Sesion } from '../../core/auth/sesion';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { EstadoChip } from '../../core/ui/estado-chip';
import { DiaPipe, UtcPipe } from '../../core/ui/fechas';
import { FormularioOrden } from './formulario-orden';
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
    EstadoChip,
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
      @if (puedeGestionar) {
        <button matButton="filled" type="button" (click)="nueva()">
          <mat-icon>add</mat-icon>
          Nueva orden
        </button>
      }
    </div>
    <p class="ayuda">
      Cada orden recorre las etapas de producción y arrastra las líneas de pedido que atiende. Al
      llegar a Almacén 1 consume los materiales de la lista y lo producido entra a la bodega
      comprometido para esas líneas.
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
        <mat-label>Etapa</mat-label>
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
            <ng-container matColumnDef="item">
              <th mat-header-cell *matHeaderCellDef>Ítem</th>
              <td mat-cell *matCellDef="let o">
                <span class="codigo">{{ o.itemCodigo }}</span>
                <span class="secundario">{{ o.itemDescripcion }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="cantidad">
              <th mat-header-cell *matHeaderCellDef class="numero">Piezas</th>
              <td mat-cell *matCellDef="let o" class="numero">
                {{ o.cantidadProcesada | number }} / {{ o.cantidad | number }}
                <span class="secundario">{{ o.unidad }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="etapa">
              <th mat-header-cell *matHeaderCellDef>Etapa</th>
              <td mat-cell *matCellDef="let o">
                <pi-estado-chip [estado]="o.etapa" />
                @if (o.estado !== 'ABIERTA') {
                  <span class="secundario estado">{{ nombreDe(o) }}</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="pedidos">
              <th mat-header-cell *matHeaderCellDef>Pedidos</th>
              <td mat-cell *matCellDef="let o">
                {{ o.pedidos?.length ? o.pedidos.join(', ') : 'Para inventario' }}
                <span class="secundario">Entra a {{ o.bodegaDestino }}</span>
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
    .cabecera button {
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
    .estado {
      display: block;
      margin-top: 4px;
    }
    td .secundario {
      display: block;
    }
  `,
})
export class OrdenesProduccion {
  private readonly api = inject(Api);
  private readonly dialogos = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly puedeGestionar = inject(Sesion).tienePermiso(PERMISOS.gestionarProduccion);
  protected readonly columnas = ['numero', 'item', 'cantidad', 'etapa', 'pedidos', 'fecha'];
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

  protected nueva(): void {
    this.dialogos
      .open<FormularioOrden, OrdenProduccionDto | undefined, OrdenProduccionDto>(FormularioOrden, {
        width: '560px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((orden) => {
        if (orden) {
          void this.router.navigate(['/produccion', orden.id]);
        }
      });
  }
}
