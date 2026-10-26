import { Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { leerProblema } from '../http/problema';

export interface DatosJustificacion {
  titulo: string;
  mensaje: string;
  /** Texto del botón que confirma, ej. "Anular". */
  accion: string;
  /** Ejecuta la acción con la justificación; si falla, el diálogo muestra el error y sigue abierto. */
  ejecutar: (justificacion: string) => Promise<unknown>;
}

/**
 * Acción que exige explicar el porqué (anular una orden o una remisión). Igual que en el backend: entre 10 y 500
 * caracteres. Devuelve el resultado de la acción, o nada si se cancela.
 */
@Component({
  selector: 'pi-justificacion',
  imports: [FormField, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ datos.titulo }}</h2>
    <form (submit)="confirmar($event)" novalidate>
      <mat-dialog-content>
        <p class="mensaje">{{ datos.mensaje }}</p>
        @if (error(); as mensaje) {
          <p class="mensaje-error" role="alert">{{ mensaje }}</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>Justificación</mat-label>
          <textarea matInput rows="3" [formField]="formulario.justificacion"></textarea>
          <mat-hint align="end">{{ datosFormulario().justificacion.length }}/500</mat-hint>
          @for (e of formulario.justificacion().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit" [disabled]="formulario().submitting()">
          {{ datos.accion }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .mensaje {
      margin: 0;
    }
    mat-dialog-actions button {
      min-height: 48px;
      padding-inline: 24px;
    }
    .mensaje-error {
      margin: 0;
      padding: 12px 16px;
      border-radius: var(--mat-sys-corner-medium);
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class Justificacion {
  private readonly dialogo = inject(MatDialogRef<Justificacion, unknown>);
  protected readonly datos = inject<DatosJustificacion>(MAT_DIALOG_DATA);

  protected readonly datosFormulario = signal({ justificacion: '' });
  protected readonly formulario = form(this.datosFormulario, (d) => {
    required(d.justificacion, { message: 'Escriba la justificación.' });
    minLength(d.justificacion, 10, { message: 'Mínimo 10 caracteres.' });
    maxLength(d.justificacion, 500, { message: 'Máximo 500 caracteres.' });
  });
  protected readonly error = signal<string | null>(null);

  protected async confirmar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      try {
        this.dialogo.close(await this.datos.ejecutar(this.datosFormulario().justificacion.trim()));
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
