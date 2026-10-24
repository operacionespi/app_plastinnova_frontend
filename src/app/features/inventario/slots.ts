import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { SlotDto } from '../../api/models/slot-dto';
import { leerProblema } from '../../core/http/problema';
import { Avisos } from '../../core/ui/avisos';
import { DatosFormularioSlot, FormularioSlot } from './formulario-slot';
import { CatalogoInventario } from './inventario';

/** Slots de cada bodega: crear, renombrar y desactivar (un slot con existencias no se desactiva). */
@Component({
  selector: 'pi-slots',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    RouterLink,
  ],
  template: `
    <a matButton class="volver" routerLink="/inventario">
      <mat-icon>arrow_back</mat-icon>
      Inventario
    </a>
    <div class="cabecera">
      <h1>Slots</h1>
      <span class="espacio"></span>
      <button matButton="filled" type="button" (click)="editar()">
        <mat-icon>add</mat-icon>
        Nuevo slot
      </button>
    </div>

    <mat-form-field appearance="outline" class="bodega compacto" subscriptSizing="dynamic">
      <mat-label>Bodega</mat-label>
      <mat-select [value]="bodegaId()" (selectionChange)="bodegaId.set($event.value)">
        <mat-option [value]="null">Todas</mat-option>
        @for (b of catalogo.bodegas.value() ?? []; track b.id) {
          <mat-option [value]="b.id">{{ b.codigo }} · {{ b.descripcion }}</mat-option>
        }
      </mat-select>
    </mat-form-field>

    @if (error(); as mensaje) {
      <div class="mensaje-error" role="alert">
        <span>{{ mensaje }}</span>
        <button matButton type="button" (click)="catalogo.slots.reload()">Reintentar</button>
      </div>
    } @else if (catalogo.slots.hasValue()) {
      @if (slots().length) {
        <div class="tabla">
          <table mat-table [dataSource]="slots()" aria-label="Slots">
            <ng-container matColumnDef="bodega">
              <th mat-header-cell *matHeaderCellDef>Bodega</th>
              <td mat-cell *matCellDef="let s">{{ s.bodegaCodigo }}</td>
            </ng-container>
            <ng-container matColumnDef="codigo">
              <th mat-header-cell *matHeaderCellDef>Código</th>
              <td mat-cell *matCellDef="let s" class="codigo">{{ s.codigo }}</td>
            </ng-container>
            <ng-container matColumnDef="descripcion">
              <th mat-header-cell *matHeaderCellDef>Descripción</th>
              <td mat-cell *matCellDef="let s">{{ s.descripcion || '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="activo">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let s">{{ s.activo ? 'Activo' : 'Inactivo' }}</td>
            </ng-container>
            <ng-container matColumnDef="acciones">
              <th mat-header-cell *matHeaderCellDef>
                <span class="cdk-visually-hidden">Acciones</span>
              </th>
              <td mat-cell *matCellDef="let s" class="acciones">
                <button
                  matIconButton
                  type="button"
                  [attr.aria-label]="'Editar slot ' + s.codigo"
                  (click)="editar(s)"
                >
                  <mat-icon>edit</mat-icon>
                </button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columnas"></tr>
            <tr
              mat-row
              *matRowDef="let fila; columns: columnas"
              [class.inactivo]="!fila.activo"
            ></tr>
          </table>
        </div>
      } @else {
        <p class="vacio">
          {{ bodegaId() ? 'Esta bodega no tiene slots.' : 'Aún no hay slots.' }} Cree el primero con
          «Nuevo slot».
        </p>
      }
    } @else {
      <mat-progress-bar mode="indeterminate" aria-label="Cargando slots" />
    }
  `,
  styles: `
    .volver {
      margin: -8px 0 8px -12px;
    }
    .cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }
    .cabecera button {
      min-height: 48px;
    }
    .espacio {
      flex: 1;
    }
    .bodega {
      width: 100%;
      max-width: 420px;
      margin-bottom: 16px;
    }
    .tabla {
      overflow-x: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
    }
    table {
      width: 100%;
    }
    .codigo {
      font-weight: 500;
    }
    .acciones {
      width: 56px;
      text-align: right;
    }
    tr.inactivo td {
      color: var(--mat-sys-on-surface-variant);
    }
    .vacio {
      color: var(--mat-sys-on-surface-variant);
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
  `,
})
export class Slots {
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  protected readonly catalogo = inject(CatalogoInventario);

  protected readonly bodegaId = signal<number | null>(null);
  protected readonly slots = computed(() =>
    (this.catalogo.slots.value() ?? []).filter(
      (s) => this.bodegaId() === null || s.bodegaId === this.bodegaId(),
    ),
  );
  protected readonly error = computed(() =>
    this.catalogo.slots.error() ? leerProblema(this.catalogo.slots.error()).mensaje : null,
  );
  protected readonly columnas = ['bodega', 'codigo', 'descripcion', 'activo', 'acciones'];

  protected editar(slot?: SlotDto): void {
    this.dialogos
      .open<FormularioSlot, DatosFormularioSlot, SlotDto>(FormularioSlot, {
        data: { slot, bodegaId: this.bodegaId() ?? undefined },
        width: '480px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((guardado) => {
        if (guardado) {
          this.avisos.exito(`Slot ${guardado.bodegaCodigo} / ${guardado.codigo} guardado.`);
          this.catalogo.slots.reload();
        }
      });
  }
}
