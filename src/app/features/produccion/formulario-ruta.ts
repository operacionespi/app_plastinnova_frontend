import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, maxLength, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { rutaProduccionActualizar } from '../../api/fn/rutas-de-produccion/ruta-produccion-actualizar';
import { rutaProduccionCrear } from '../../api/fn/rutas-de-produccion/ruta-produccion-crear';
import { EstadoResponseDto } from '../../api/models/estado-response-dto';
import { RutaProduccionDto } from '../../api/models/ruta-produccion-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';

export interface DatosRuta {
  /** Si viene, se edita; si no, se crea. */
  ruta?: RutaProduccionDto;
  /** Etapas que pueden ser procesos de una ruta. */
  procesos: EstadoResponseDto[];
}

interface Modelo {
  nombre: string;
  descripcion: string;
  activa: boolean;
}

/** Crea o edita una ruta: nombre, descripción y los procesos en orden. Devuelve la ruta guardada. */
@Component({
  selector: 'pi-formulario-ruta',
  imports: [
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ datos.ruta ? 'Editar ' + datos.ruta.nombre : 'Nueva ruta' }}</h2>
    <form (submit)="guardar($event)" novalidate>
      <mat-dialog-content>
        @if (error(); as mensaje) {
          <p class="mensaje-error" role="alert">{{ mensaje }}</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput autocomplete="off" [formField]="formulario.nombre" />
          @for (e of formulario.nombre().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Descripción</mat-label>
          <input matInput autocomplete="off" [formField]="formulario.descripcion" />
          @for (e of formulario.descripcion().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>

        <fieldset class="grupo">
          <legend>Procesos, en orden</legend>
          <ol class="elegidos">
            @for (e of elegidos(); track e.id; let i = $index; let ultimo = $last) {
              <li>
                <span
                  class="punto"
                  aria-hidden="true"
                  [style.background-color]="e.color ?? null"
                ></span>
                <span class="crece">{{ i + 1 }}. {{ e.nombre }}</span>
                <button
                  matIconButton
                  type="button"
                  [disabled]="i === 0"
                  [attr.aria-label]="'Subir ' + e.nombre"
                  (click)="mover(i, -1)"
                >
                  <mat-icon>arrow_upward</mat-icon>
                </button>
                <button
                  matIconButton
                  type="button"
                  [disabled]="ultimo"
                  [attr.aria-label]="'Bajar ' + e.nombre"
                  (click)="mover(i, 1)"
                >
                  <mat-icon>arrow_downward</mat-icon>
                </button>
                <button
                  matIconButton
                  type="button"
                  [attr.aria-label]="'Quitar ' + e.nombre"
                  (click)="quitar(e)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </li>
            } @empty {
              <li class="vacio">Agregue al menos un proceso.</li>
            }
          </ol>
          @if (disponibles().length) {
            <div class="disponibles">
              @for (e of disponibles(); track e.id) {
                <button matButton="outlined" type="button" (click)="agregar(e)">
                  <mat-icon>add</mat-icon>
                  {{ e.nombre }}
                </button>
              }
            </div>
          }
          <p class="ayuda">Después del último proceso, las piezas van al almacén.</p>
        </fieldset>

        @if (datos.ruta) {
          <mat-checkbox [formField]="formulario.activa">
            Activa (una ruta inactiva no se asigna; sus ítems recorren todos los procesos)
          </mat-checkbox>
        }
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
  styles: `
    .elegidos {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0 0 8px;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        gap: 4px;
        padding-left: 12px;
        border-radius: var(--mat-sys-corner-small);
        background-color: var(--mat-sys-surface-container);
      }
      li.vacio {
        padding: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
    }
    .crece {
      flex: 1;
    }
    .disponibles {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      button {
        min-height: 48px;
      }
    }
    .ayuda {
      margin-top: 8px;
    }
  `,
})
export class FormularioRuta {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<FormularioRuta, RutaProduccionDto>);
  protected readonly datos = inject<DatosRuta>(MAT_DIALOG_DATA);

  protected readonly modelo = signal<Modelo>({
    nombre: this.datos.ruta?.nombre ?? '',
    descripcion: this.datos.ruta?.descripcion ?? '',
    activa: this.datos.ruta?.activa ?? true,
  });
  protected readonly formulario = form(this.modelo, (d) => {
    required(d.nombre, { message: 'Ingrese el nombre.' });
    maxLength(d.nombre, 100, { message: 'Máximo 100 caracteres.' });
    maxLength(d.descripcion, 255, { message: 'Máximo 255 caracteres.' });
  });
  protected readonly elegidos = signal<EstadoResponseDto[]>(this.datos.ruta?.etapas ?? []);
  protected readonly disponibles = computed(() =>
    this.datos.procesos.filter((p) => !this.elegidos().some((e) => e.id === p.id)),
  );
  protected readonly error = signal<string | null>(null);

  protected agregar(etapa: EstadoResponseDto): void {
    this.elegidos.update((e) => [...e, etapa]);
  }

  protected quitar(etapa: EstadoResponseDto): void {
    this.elegidos.update((e) => e.filter((x) => x.id !== etapa.id));
  }

  protected mover(indice: number, delta: number): void {
    this.elegidos.update((e) => {
      const copia = [...e];
      [copia[indice], copia[indice + delta]] = [copia[indice + delta], copia[indice]];
      return copia;
    });
  }

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    if (!this.elegidos().length) {
      this.error.set('La ruta debe tener al menos un proceso.');
      return;
    }
    await submit(this.formulario, async () => {
      const m = this.modelo();
      const body = {
        nombre: m.nombre.trim(),
        descripcion: m.descripcion.trim() || undefined,
        etapaIds: this.elegidos().map((e) => e.id ?? 0),
        activa: m.activa,
      };
      const contexto = new HttpContext().set(MANEJA_ERRORES, true);
      try {
        this.dialogo.close(
          this.datos.ruta
            ? await this.api.invoke(
                rutaProduccionActualizar,
                { id: this.datos.ruta.id ?? 0, body },
                contexto,
              )
            : await this.api.invoke(rutaProduccionCrear, { body }, contexto),
        );
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
