import { DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { form, FormField, max, min, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { reservaInventarioReservar } from '../../api/fn/reservas-de-inventario/reserva-inventario-reservar';
import { ReservaLineaDto } from '../../api/models/reserva-linea-dto';
import { ReservasPedidoDto } from '../../api/models/reservas-pedido-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';

export interface DatosReservarLinea {
  pedidoId: number;
  bodega: string;
  linea: ReservaLineaDto;
}

/** Cambia lo comprometido para una línea (0 lo libera). Devuelve las reservas del pedido ya actualizadas. */
@Component({
  selector: 'pi-reservar-linea',
  imports: [
    DecimalPipe,
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Comprometer {{ linea.itemCodigo }}</h2>
    <form (submit)="guardar($event)" novalidate>
      <mat-dialog-content>
        @if (error(); as mensaje) {
          <p class="mensaje-error" role="alert">{{ mensaje }}</p>
        }
        <p class="resumen">
          Línea {{ linea.posicion ?? '—' }} · solicita {{ linea.cantidadSolicitada | number }}
          {{ linea.unidad }}. En {{ datosDialogo.bodega }} hay
          {{ linea.existencia | number: '1.0-6' }} y están libres
          {{ linea.libre | number: '1.0-6' }}.
        </p>
        <mat-form-field appearance="outline">
          <mat-label>Cantidad comprometida</mat-label>
          <input matInput type="number" inputmode="decimal" [formField]="formulario.cantidad" />
          <mat-hint>Máximo {{ maximo | number: '1.0-6' }}. 0 libera la reserva.</mat-hint>
          @for (e of formulario.cantidad().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit">Guardar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .resumen {
      margin: 0 0 8px;
    }
    mat-dialog-actions button {
      min-height: 48px;
      padding-inline: 24px;
    }
    .mensaje-error {
      margin: 0 0 8px;
      padding: 12px 16px;
      border-radius: var(--mat-sys-corner-medium);
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class ReservarLinea {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<ReservarLinea, ReservasPedidoDto>);
  protected readonly datosDialogo = inject<DatosReservarLinea>(MAT_DIALOG_DATA);
  protected readonly linea = this.datosDialogo.linea;
  protected readonly maximo = this.linea.maximoReservable ?? 0;

  protected readonly datos = signal<{ cantidad: number | null }>({
    cantidad: this.linea.reservada || this.maximo,
  });
  protected readonly formulario = form(this.datos, (d) => {
    required(d.cantidad, { message: 'Ingrese la cantidad.' });
    min(d.cantidad, 0, { message: 'No puede ser negativa.' });
    max(d.cantidad, this.maximo, {
      message: `No puede superar ${this.maximo}: lo solicitado o lo libre.`,
    });
  });
  protected readonly error = signal<string | null>(null);

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      try {
        const reservas = await this.api.invoke(
          reservaInventarioReservar,
          {
            id: this.datosDialogo.pedidoId,
            detalleId: this.linea.detalleId ?? 0,
            body: { cantidad: this.datos().cantidad ?? 0 },
          },
          new HttpContext().set(MANEJA_ERRORES, true),
        );
        this.dialogo.close(reservas);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
