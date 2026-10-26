import { HttpContext } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { ordenProduccionEditar } from '../../api/fn/ordenes-de-produccion/orden-produccion-editar';
import { OrdenProduccionDto } from '../../api/models/orden-produccion-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';

interface Modelo {
  fechaRequerida: string;
  observaciones: string;
}

/** Edita la fecha requerida y las observaciones de una orden. Devuelve la orden guardada. */
@Component({
  selector: 'pi-formulario-orden',
  imports: [FormField, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Editar {{ orden.numero }}</h2>
    <form (submit)="guardar($event)" novalidate>
      <mat-dialog-content>
        @if (error(); as mensaje) {
          <p class="mensaje-error" role="alert">{{ mensaje }}</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>Fecha requerida</mat-label>
          <input matInput type="date" [formField]="formulario.fechaRequerida" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Observaciones</mat-label>
          <textarea matInput rows="3" [formField]="formulario.observaciones"></textarea>
          @for (e of formulario.observaciones().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit" [disabled]="formulario().submitting()">
          Guardar
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: '../pedidos/dialogo-pedido.scss',
})
export class FormularioOrden {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<FormularioOrden, OrdenProduccionDto>);
  protected readonly orden = inject<OrdenProduccionDto>(MAT_DIALOG_DATA);

  protected readonly datos = signal<Modelo>({
    fechaRequerida: this.orden.fechaRequerida ?? '',
    observaciones: this.orden.observaciones ?? '',
  });
  protected readonly formulario = form(this.datos, (d) => {
    maxLength(d.observaciones, 500, { message: 'Máximo 500 caracteres.' });
  });
  protected readonly error = signal<string | null>(null);

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const d = this.datos();
      try {
        this.dialogo.close(
          await this.api.invoke(
            ordenProduccionEditar,
            {
              id: this.orden.id ?? 0,
              body: {
                fechaRequerida: d.fechaRequerida || undefined,
                observaciones: d.observaciones.trim() || undefined,
              },
            },
            new HttpContext().set(MANEJA_ERRORES, true),
          ),
        );
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
