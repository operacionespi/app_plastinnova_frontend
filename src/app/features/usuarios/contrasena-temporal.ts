import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ContrasenaTemporalResponseDto } from '../../api/models/contrasena-temporal-response-dto';

export interface DatosContrasenaTemporal {
  titulo: string;
  resultado: ContrasenaTemporalResponseDto;
}

/**
 * Muestra la contraseña temporal una sola vez (el backend no la guarda en claro). El administrador se la
 * comunica al usuario, que debe cambiarla al ingresar.
 */
@Component({
  selector: 'pi-contrasena-temporal',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ datos.titulo }}</h2>
    <mat-dialog-content>
      <p>
        Entregue estos datos a <strong>{{ datos.resultado.usuario?.nombreCompleto }}</strong
        >. Al ingresar, la aplicación le pedirá cambiar la contraseña.
      </p>
      <dl>
        <dt>Usuario</dt>
        <dd>{{ datos.resultado.usuario?.email }}</dd>
        <dt>Contraseña temporal</dt>
        <dd class="clave">{{ datos.resultado.contrasenaTemporal }}</dd>
      </dl>
      <p class="advertencia" role="note">
        <mat-icon aria-hidden="true">visibility_off</mat-icon>
        No se volverá a mostrar. Si se pierde, restablezca la contraseña de nuevo.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" (click)="copiar()">
        <mat-icon>{{ copiada() ? 'check' : 'content_copy' }}</mat-icon>
        {{ copiada() ? 'Copiada' : 'Copiar contraseña' }}
      </button>
      <button matButton="filled" type="button" mat-dialog-close cdkFocusInitial>Listo</button>
    </mat-dialog-actions>
  `,
  styles: `
    p {
      margin: 0 0 12px;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 8px 16px;
      margin: 0 0 12px;
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .clave {
      font-family: 'Roboto Mono', ui-monospace, monospace;
      font-size: 1.25rem;
      letter-spacing: 0.04em;
    }
    .advertencia {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    button {
      min-height: 48px;
    }
  `,
})
export class ContrasenaTemporal {
  protected readonly datos = inject<DatosContrasenaTemporal>(MAT_DIALOG_DATA);
  protected readonly copiada = signal(false);

  protected async copiar(): Promise<void> {
    await navigator.clipboard.writeText(this.datos.resultado.contrasenaTemporal ?? '');
    this.copiada.set(true);
  }
}
