import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { Sesion } from '../core/auth/sesion';
import { Navegacion } from '../core/navegacion/navegacion';

@Component({
  selector: 'pi-menu-usuario',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, RouterLink],
  template: `
    <button matButton [matMenuTriggerFor]="menu" aria-label="Menú de la cuenta">
      <mat-icon>account_circle</mat-icon>
      <span class="nombre">{{ sesion.usuario()?.nombreCompleto }}</span>
    </button>
    <mat-menu #menu="matMenu" xPosition="before">
      <div class="encabezado">
        <strong>{{ sesion.usuario()?.nombreCompleto }}</strong>
        <span>{{ sesion.usuario()?.email }}</span>
        <span>{{ navegacion.nombreRoles() }}</span>
      </div>
      <mat-divider />
      <a mat-menu-item routerLink="/cuenta">
        <mat-icon>key</mat-icon>
        <span>Cambiar contraseña</span>
      </a>
      <button mat-menu-item (click)="sesion.cerrarSesion()">
        <mat-icon>logout</mat-icon>
        <span>Cerrar sesión</span>
      </button>
    </mat-menu>
  `,
  styles: `
    .encabezado {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px 16px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .encabezado strong {
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface);
    }
    @media (max-width: 599px) {
      .nombre {
        display: none;
      }
    }
  `,
})
export class MenuUsuario {
  protected readonly sesion = inject(Sesion);
  protected readonly navegacion = inject(Navegacion);
}
