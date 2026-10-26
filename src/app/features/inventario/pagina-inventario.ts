import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink } from '@angular/router';
import { CargaExistenciasDto } from '../../api/models/carga-existencias-dto';
import { MovimientoDto } from '../../api/models/movimiento-dto';
import { Sesion } from '../../core/auth/sesion';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { Avisos } from '../../core/ui/avisos';
import { CargarExistencias } from './cargar-existencias';
import { AccionExistencia, Existencias } from './existencias';
import { NOMBRE_TIPO_MOVIMIENTO } from './inventario';
import { Movimientos } from './movimientos';
import { DatosMovimiento, RegistrarMovimiento } from './registrar-movimiento';
import { Reservas } from './reservas';

/** Pestañas en el orden en que aparecen; la primera no va en la URL. */
const VISTAS = ['existencias', 'movimientos', 'reservas'];

/**
 * Inventario por bodega y slot: existencias, bitácora de movimientos y producto comprometido por los pedidos. La
 * pestaña va en la URL (?vista=movimientos) para que atrás y recargar la conserven.
 */
@Component({
  selector: 'pi-pagina-inventario',
  imports: [
    Existencias,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    Movimientos,
    Reservas,
    RouterLink,
  ],
  template: `
    <div class="cabecera">
      <h1>Inventario</h1>
      <span class="espacio"></span>
      @if (puede.gestionar) {
        <a matButton="outlined" routerLink="/inventario/slots">
          <mat-icon>shelves</mat-icon>
          Slots
        </a>
        <button matButton="outlined" type="button" (click)="cargar()">
          <mat-icon>upload_file</mat-icon>
          Cargar existencias
        </button>
      }
      @if (puede.mover) {
        <button matButton="filled" type="button" (click)="registrar()">
          <mat-icon>add</mat-icon>
          Registrar movimiento
        </button>
      }
    </div>

    <mat-tab-group
      mat-stretch-tabs="false"
      [selectedIndex]="indiceVista()"
      (selectedIndexChange)="cambiarVista($event)"
    >
      <mat-tab label="Existencias">
        <pi-existencias
          [version]="version()"
          [puedeMover]="puede.mover"
          (mover)="moverDesde($event)"
        />
      </mat-tab>
      <mat-tab label="Movimientos">
        <ng-template matTabContent>
          <pi-movimientos [version]="version()" />
        </ng-template>
      </mat-tab>
      <mat-tab label="Reservas">
        <ng-template matTabContent>
          <pi-reservas [version]="version()" />
        </ng-template>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: `
    .cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }
    .cabecera button,
    .cabecera a {
      min-height: 48px;
    }
    .espacio {
      flex: 1;
    }
  `,
})
export class PaginaInventario {
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);
  private readonly sesion = inject(Sesion);

  /** Parámetro de la URL. */
  readonly vista = input<string>();

  protected readonly puede = {
    mover: this.sesion.tienePermiso(PERMISOS.moverInventario),
    gestionar: this.sesion.tienePermiso(PERMISOS.gestionarInventario),
  };
  /** Sube con cada movimiento o carga: las pestañas vuelven a consultar. */
  protected readonly version = signal(0);

  protected readonly indiceVista = computed(() => Math.max(VISTAS.indexOf(this.vista() ?? ''), 0));

  protected cambiarVista(indice: number): void {
    void this.router.navigate([], { queryParams: { vista: indice > 0 ? VISTAS[indice] : null } });
  }

  protected registrar(datos?: DatosMovimiento): void {
    this.dialogos
      .open<RegistrarMovimiento, DatosMovimiento, MovimientoDto>(RegistrarMovimiento, {
        data: datos ?? {},
        width: '640px',
        maxWidth: '95vw',
        autoFocus: datos?.itemCodigo ? 'input[type=number]' : 'first-tabbable',
      })
      .afterClosed()
      .subscribe((movimiento) => {
        if (movimiento) {
          this.avisos.exito(
            `${NOMBRE_TIPO_MOVIMIENTO[movimiento.tipo ?? 'ENTRADA']} de ${movimiento.itemCodigo} registrada.`,
          );
          this.version.update((v) => v + 1);
        }
      });
  }

  protected moverDesde({ tipo, existencia }: AccionExistencia): void {
    this.registrar({
      tipo,
      itemCodigo: existencia.itemCodigo,
      slotId: existencia.slotId,
      saldo: existencia.cantidad,
      unidad: existencia.unidad,
    });
  }

  protected cargar(): void {
    this.dialogos
      .open<CargarExistencias, void, CargaExistenciasDto>(CargarExistencias, {
        width: '640px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((carga) => {
        if (carga) {
          this.version.update((v) => v + 1);
        }
      });
  }
}
