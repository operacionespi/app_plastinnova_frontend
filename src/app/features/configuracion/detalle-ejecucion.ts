import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { SyncLogResponseDto } from '../../api/models/sync-log-response-dto';
import { UtcPipe } from '../../core/ui/fechas';

/** Error y avisos de una ejecución (ej. pedidos con datos incompletos en FileMaker). */
@Component({
  selector: 'pi-detalle-ejecucion',
  imports: [DatePipe, MatButtonModule, MatDialogModule, UtcPipe],
  template: `
    <h2 mat-dialog-title>
      Ejecución del {{ ejecucion.fechaInicio | utc | date: 'd MMM y, h:mm a' }}
    </h2>
    <mat-dialog-content>
      @if (ejecucion.mensajeError) {
        <h3>Error</h3>
        <p class="error">{{ ejecucion.mensajeError }}</p>
      }
      @if (avisos().length) {
        <h3>Avisos ({{ avisos().length }})</h3>
        <ul>
          @for (aviso of avisos(); track $index) {
            <li>{{ aviso }}</li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="filled" type="button" mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    h3 {
      margin: 8px 0;
      font: var(--mat-sys-title-small);
    }
    .error {
      padding: 12px 16px;
      border-radius: var(--mat-sys-corner-medium);
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      white-space: pre-wrap;
    }
    ul {
      margin: 0;
      padding-left: 20px;
    }
    li {
      margin: 4px 0;
    }
    button {
      min-height: 48px;
      padding-inline: 24px;
    }
  `,
})
export class DetalleEjecucion {
  protected readonly ejecucion = inject<SyncLogResponseDto>(MAT_DIALOG_DATA);
  /** El backend guarda los avisos uno por línea. */
  protected readonly avisos = computed(() =>
    (this.ejecucion.avisos ?? '')
      .split('\n')
      .map((a) => a.trim())
      .filter(Boolean),
  );
}
