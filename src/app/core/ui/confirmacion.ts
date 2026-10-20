import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface DatosConfirmacion {
  titulo: string;
  mensaje: string;
  /** Texto del botón que confirma, ej. "Eliminar". */
  accion: string;
}

/** Pregunta antes de una acción con efecto amplio. Devuelve true solo si el usuario confirma. */
@Component({
  selector: 'pi-confirmacion',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ datos.titulo }}</h2>
    <mat-dialog-content>
      <p>{{ datos.mensaje }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false" cdkFocusInitial>Cancelar</button>
      <button matButton="filled" type="button" [mat-dialog-close]="true">{{ datos.accion }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    p {
      margin: 0;
    }
    button {
      min-height: 48px;
      padding-inline: 24px;
    }
  `,
})
export class Confirmacion {
  protected readonly datos = inject<DatosConfirmacion>(MAT_DIALOG_DATA);
}
