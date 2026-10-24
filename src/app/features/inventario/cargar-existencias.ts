import { DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Api } from '../../api/api';
import { inventarioCargar } from '../../api/fn/inventario/inventario-cargar';
import { CargaExistenciasDto } from '../../api/models/carga-existencias-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';

/**
 * Carga inicial de existencias desde CSV (Bodega, Slot, Item, Cantidad). Cada fila deja ese saldo; si alguna tiene
 * errores no se carga nada. Retorna el resumen al cerrar.
 */
@Component({
  selector: 'pi-cargar-existencias',
  imports: [DecimalPipe, MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Cargar existencias</h2>
    <mat-dialog-content>
      @if (resultado(); as r) {
        <p class="exito" role="status">
          <mat-icon aria-hidden="true">check_circle</mat-icon>
          Se leyeron {{ r.filas | number }} filas: {{ r.movimientos | number }} saldos cambiaron
          @if (r.slotsCreados) {
            y se crearon {{ r.slotsCreados | number }} slots
          }
          .
        </p>
        @for (aviso of r.avisos ?? []; track $index) {
          <p class="aviso">{{ aviso }}</p>
        }
      } @else {
        <p>
          Archivo CSV con las columnas <strong>Bodega, Slot, Item, Cantidad</strong>. Cada fila es
          un conteo: el saldo del ítem en ese slot queda en esa cantidad y la diferencia se registra
          en los movimientos. Los saldos que no vienen en el archivo no cambian y los slots que no
          existen se crean.
        </p>
        <label for="archivo-existencias">Archivo</label>
        <input
          id="archivo-existencias"
          type="file"
          accept=".csv,text/csv"
          [disabled]="cargando()"
          (change)="elegir($event)"
        />
        @if (cargando()) {
          <p role="status">Cargando…</p>
          <mat-progress-bar mode="indeterminate" aria-label="Cargando existencias" />
        }
        @if (error(); as mensaje) {
          <p class="error" role="alert">{{ mensaje }}</p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (resultado(); as r) {
        <button matButton="filled" type="button" [mat-dialog-close]="r">Cerrar</button>
      } @else {
        <button matButton type="button" mat-dialog-close [disabled]="cargando()">Cancelar</button>
        <button
          matButton="filled"
          type="button"
          [disabled]="!archivo() || cargando()"
          (click)="cargar()"
        >
          Cargar
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    label {
      display: block;
      margin-bottom: 4px;
      font: var(--mat-sys-title-small);
    }
    input[type='file'] {
      min-height: 48px;
    }
    .exito {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .aviso {
      overflow-wrap: anywhere;
    }
    .error {
      padding: 12px 16px;
      border-radius: var(--mat-sys-corner-medium);
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      white-space: pre-wrap;
    }
    button {
      min-height: 48px;
      padding-inline: 24px;
    }
  `,
})
export class CargarExistencias {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<CargarExistencias, CargaExistenciasDto>);

  protected readonly archivo = signal<File | undefined>(undefined);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly resultado = signal<CargaExistenciasDto | null>(null);

  protected elegir(evento: Event): void {
    this.archivo.set((evento.target as HTMLInputElement).files?.[0]);
    this.error.set(null);
  }

  protected async cargar(): Promise<void> {
    const existencias = this.archivo();
    if (!existencias) {
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.dialogo.disableClose = true;
    try {
      this.resultado.set(
        await this.api.invoke(
          inventarioCargar,
          { body: { existencias } },
          new HttpContext().set(MANEJA_ERRORES, true),
        ),
      );
    } catch (e) {
      // Los errores del archivo vienen separados por " | ": uno por renglón
      this.error.set(leerProblema(e).mensaje.split(' | ').join('\n'));
    }
    this.cargando.set(false);
    this.dialogo.disableClose = false;
  }
}
