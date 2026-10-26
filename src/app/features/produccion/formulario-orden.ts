import { HttpContext } from '@angular/common/http';
import { Component, inject, resource, signal } from '@angular/core';
import {
  debounce,
  form,
  FormField,
  max,
  maxLength,
  min,
  readonly,
  required,
  submit,
} from '@angular/forms/signals';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { listaMaterialesBuscarItems } from '../../api/fn/lista-de-materiales/lista-materiales-buscar-items';
import { ordenProduccionCrear } from '../../api/fn/ordenes-de-produccion/orden-produccion-crear';
import { ordenProduccionEditar } from '../../api/fn/ordenes-de-produccion/orden-produccion-editar';
import { OrdenProduccionDto } from '../../api/models/orden-produccion-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';

interface Modelo {
  itemCodigo: string;
  cantidad: number | null;
  fechaRequerida: string;
  observaciones: string;
}

/**
 * Crea una orden de producción, o edita su cantidad, fecha requerida y observaciones (el ítem no cambia). Devuelve la
 * orden guardada.
 */
@Component({
  selector: 'pi-formulario-orden',
  imports: [
    FormField,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ orden ? 'Editar ' + orden.numero : 'Nueva orden de producción' }}</h2>
    <form (submit)="guardar($event)" novalidate>
      <mat-dialog-content>
        @if (error(); as mensaje) {
          <p class="mensaje-error" role="alert">{{ mensaje }}</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>Ítem a producir</mat-label>
          <input
            matInput
            autocomplete="off"
            [formField]="formulario.itemCodigo"
            [matAutocomplete]="items"
          />
          <mat-autocomplete #items="matAutocomplete">
            @for (i of sugerencias.value()?.content ?? []; track i.codigo) {
              <mat-option [value]="i.codigo">
                <span class="codigo">{{ i.codigo }}</span> {{ i.descripcion }}
              </mat-option>
            }
          </mat-autocomplete>
          @if (orden) {
            <mat-hint>{{ orden.itemDescripcion }}</mat-hint>
          } @else {
            <mat-hint>Escriba parte del código o la descripción</mat-hint>
          }
          @for (e of formulario.itemCodigo().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
        <div class="fila">
          <mat-form-field appearance="outline" class="crece">
            <mat-label>Cantidad</mat-label>
            <input matInput type="number" inputmode="numeric" [formField]="formulario.cantidad" />
            @if (orden?.cantidadAsignada) {
              <mat-hint>Las líneas tienen {{ orden?.cantidadAsignada }} asignadas</mat-hint>
            }
            @for (e of formulario.cantidad().errors(); track e.kind) {
              <mat-error>{{ e.message }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="crece">
            <mat-label>Fecha requerida</mat-label>
            <input matInput type="date" [formField]="formulario.fechaRequerida" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Observaciones</mat-label>
          <textarea matInput rows="2" [formField]="formulario.observaciones"></textarea>
          @for (e of formulario.observaciones().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
        @if (!orden) {
          <p class="ayuda">
            Los productos terminados entran a la bodega de producto terminado; los semiterminados, a
            la bodega donde los consume la lista de materiales. Después de crearla puede asignarle
            líneas de pedido.
          </p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit" [disabled]="formulario().submitting()">
          {{ orden ? 'Guardar' : 'Crear orden' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .fila {
      display: flex;
      flex-wrap: wrap;
      gap: 0 12px;
    }
    .crece {
      flex: 1 1 180px;
    }
    .codigo {
      font-weight: 500;
    }
    .ayuda {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
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
export class FormularioOrden {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<FormularioOrden, OrdenProduccionDto>);
  /** Si viene, se edita; si no, se crea. */
  protected readonly orden = inject<OrdenProduccionDto | undefined>(MAT_DIALOG_DATA, {
    optional: true,
  });

  protected readonly datos = signal<Modelo>({
    itemCodigo: this.orden?.itemCodigo ?? '',
    cantidad: this.orden?.cantidad ?? null,
    fechaRequerida: this.orden?.fechaRequerida ?? '',
    observaciones: this.orden?.observaciones ?? '',
  });
  // Mismas reglas que el backend (OrdenProduccionRequestDTO)
  protected readonly formulario = form(this.datos, (d) => {
    required(d.itemCodigo, { message: 'Elija el ítem.' });
    readonly(d.itemCodigo, () => !!this.orden);
    debounce(d.itemCodigo, 300);
    required(d.cantidad, { message: 'Ingrese la cantidad.' });
    min(d.cantidad, Math.max(this.orden?.cantidadAsignada ?? 0, 1), {
      message: this.orden?.cantidadAsignada
        ? `No puede ser menor que lo asignado a las líneas (${this.orden.cantidadAsignada}).`
        : 'Debe ser mayor que cero.',
    });
    max(d.cantidad, 1_000_000, { message: 'No puede pasar de 1.000.000.' });
    maxLength(d.observaciones, 500, { message: 'Máximo 500 caracteres.' });
  });
  protected readonly error = signal<string | null>(null);

  protected readonly sugerencias = resource({
    params: () => {
      const texto = this.datos().itemCodigo.trim();
      return texto.length >= 2 && !this.orden ? { texto, tamano: 10 } : undefined;
    },
    loader: ({ params }) =>
      this.api.invoke(
        listaMaterialesBuscarItems,
        params,
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const d = this.datos();
      const comun = {
        cantidad: d.cantidad ?? 0,
        fechaRequerida: d.fechaRequerida || undefined,
        observaciones: d.observaciones.trim() || undefined,
      };
      try {
        const contexto = new HttpContext().set(MANEJA_ERRORES, true);
        const guardada = this.orden
          ? await this.api.invoke(
              ordenProduccionEditar,
              { id: this.orden.id ?? 0, body: comun },
              contexto,
            )
          : await this.api.invoke(
              ordenProduccionCrear,
              { body: { ...comun, itemCodigo: d.itemCodigo.trim() } },
              contexto,
            );
        this.dialogo.close(guardada);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
