import { Component, computed, input, Resource } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { leerProblema } from '../../core/http/problema';

/** Lo que la sección necesita de un `resource()`; `Resource` no expone `reload`. */
export type RecursoTablero = Pick<Resource<unknown>, 'isLoading' | 'error' | 'hasValue'> & {
  reload(): unknown;
};

let siguienteId = 0;

/**
 * Tarjeta de un indicador: título, carga y error propios. Si un indicador falla, los demás se siguen viendo
 * (las peticiones van con MANEJA_ERRORES para no llenar la pantalla de avisos).
 */
@Component({
  selector: 'pi-seccion-tablero',
  imports: [MatButtonModule, MatProgressBarModule],
  template: `
    <div class="encabezado">
      <h3 [id]="id">{{ titulo() }}</h3>
      <ng-content select="[acciones]" />
    </div>
    <div class="carga">
      @if (recurso().isLoading()) {
        <mat-progress-bar mode="indeterminate" [attr.aria-label]="'Cargando ' + titulo()" />
      }
    </div>
    @if (error(); as mensaje) {
      <div class="error" role="alert">
        <span>{{ mensaje }}</span>
        <button matButton type="button" (click)="recurso().reload()">Reintentar</button>
      </div>
    } @else if (recurso().hasValue()) {
      <ng-content />
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface);
      min-width: 0;
    }
    .encabezado {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 40px;
    }
    h3 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .carga {
      min-height: 4px;
      margin: 8px 0;
    }
    .error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 8px 8px 16px;
      border-radius: var(--mat-sys-corner-small);
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
  host: { role: 'region', '[attr.aria-labelledby]': 'id' },
})
export class SeccionTablero {
  readonly titulo = input.required<string>();
  readonly recurso = input.required<RecursoTablero>();

  protected readonly id = `seccion-tablero-${siguienteId++}`;

  protected readonly error = computed(() =>
    this.recurso().error() ? leerProblema(this.recurso().error()).mensaje : null,
  );
}
