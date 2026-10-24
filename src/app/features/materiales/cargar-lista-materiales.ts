import { DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Api } from '../../api/api';
import { listaMaterialesCargar } from '../../api/fn/lista-de-materiales/lista-materiales-cargar';
import { CargaListaMaterialesDto } from '../../api/models/carga-lista-materiales-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';

type Archivo = 'bodegas' | 'items' | 'listaMateriales';

interface CampoArchivo {
  clave: Archivo;
  etiqueta: string;
  ejemplo: string;
}

const CAMPOS: readonly CampoArchivo[] = [
  { clave: 'bodegas', etiqueta: 'Bodegas', ejemplo: 'bodegas.csv' },
  { clave: 'items', etiqueta: 'Maestro de ítems', ejemplo: 'items.csv' },
  { clave: 'listaMateriales', etiqueta: 'Lista de materiales', ejemplo: 'lista_materiales.csv' },
];

/**
 * Recarga completa desde los tres CSV del ERP. Si alguno tiene errores no se carga nada; al terminar muestra el
 * resumen y los avisos, y retorna la carga al cerrar.
 */
@Component({
  selector: 'pi-cargar-lista-materiales',
  imports: [DecimalPipe, MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Cargar lista de materiales</h2>
    <mat-dialog-content>
      @if (resultado(); as r) {
        <p class="exito" role="status">
          <mat-icon aria-hidden="true">check_circle</mat-icon>
          Se cargaron {{ r.bodegas | number }} bodegas, {{ r.items | number }} ítems y
          {{ r.relaciones | number }} relaciones.
        </p>
        @if (r.avisos?.length) {
          <h3>Avisos</h3>
          <ul>
            @for (aviso of r.avisos; track $index) {
              <li>{{ aviso }}</li>
            }
          </ul>
        }
      } @else {
        <p>
          Seleccione los tres archivos exportados del ERP. Reemplazan la lista de materiales
          completa; si alguno tiene errores no se carga nada.
        </p>
        @for (campo of campos; track campo.clave) {
          <div class="archivo">
            <label [for]="'archivo-' + campo.clave">{{ campo.etiqueta }}</label>
            <input
              type="file"
              accept=".csv,text/csv"
              [id]="'archivo-' + campo.clave"
              [attr.aria-describedby]="'ayuda-' + campo.clave"
              [disabled]="cargando()"
              (change)="elegir(campo.clave, $event)"
            />
            <span class="ayuda" [id]="'ayuda-' + campo.clave">Ej. {{ campo.ejemplo }}</span>
          </div>
        }
        @if (cargando()) {
          <p role="status">Cargando… puede tardar unos segundos.</p>
          <mat-progress-bar mode="indeterminate" aria-label="Cargando la lista de materiales" />
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
          [disabled]="!completos() || cargando()"
          (click)="cargar()"
        >
          Cargar
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .archivo {
      display: grid;
      gap: 4px;
      margin-bottom: 16px;
    }
    label {
      font: var(--mat-sys-title-small);
    }
    input[type='file'] {
      min-height: 48px;
    }
    .ayuda {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .exito {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .error {
      padding: 12px 16px;
      border-radius: var(--mat-sys-corner-medium);
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      white-space: pre-wrap;
    }
    h3 {
      margin: 8px 0;
      font: var(--mat-sys-title-small);
    }
    ul {
      margin: 0;
      padding-left: 20px;
    }
    li {
      margin: 4px 0;
      overflow-wrap: anywhere;
    }
    button {
      min-height: 48px;
      padding-inline: 24px;
    }
  `,
})
export class CargarListaMateriales {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<CargarListaMateriales, CargaListaMaterialesDto>);

  protected readonly campos = CAMPOS;
  private readonly archivos = signal<Partial<Record<Archivo, File>>>({});
  protected readonly completos = computed(() => CAMPOS.every((c) => this.archivos()[c.clave]));
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly resultado = signal<CargaListaMaterialesDto | null>(null);

  protected elegir(clave: Archivo, evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    this.archivos.update((actuales) => ({ ...actuales, [clave]: archivo }));
    this.error.set(null);
  }

  protected async cargar(): Promise<void> {
    const { bodegas, items, listaMateriales } = this.archivos();
    if (!bodegas || !items || !listaMateriales) {
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.dialogo.disableClose = true;
    try {
      this.resultado.set(
        await this.api.invoke(
          listaMaterialesCargar,
          { body: { bodegas, items, listaMateriales } },
          new HttpContext().set(MANEJA_ERRORES, true),
        ),
      );
    } catch (e) {
      // Los errores de los archivos vienen separados por " | ": uno por renglón
      this.error.set(leerProblema(e).mensaje.split(' | ').join('\n'));
    }
    this.cargando.set(false);
    this.dialogo.disableClose = false;
  }
}
