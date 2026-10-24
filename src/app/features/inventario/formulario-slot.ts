import { HttpContext } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Api } from '../../api/api';
import { inventarioActualizarSlot } from '../../api/fn/inventario/inventario-actualizar-slot';
import { inventarioCrearSlot } from '../../api/fn/inventario/inventario-crear-slot';
import { SlotDto } from '../../api/models/slot-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { CatalogoInventario } from './inventario';

export interface DatosFormularioSlot {
  /** Sin slot: se crea uno nuevo en esta bodega. */
  slot?: SlotDto;
  bodegaId?: number;
}

interface Modelo {
  bodegaId: number | null;
  codigo: string;
  descripcion: string;
  activo: boolean;
}

/** Crea o modifica un slot. Devuelve el slot guardado. */
@Component({
  selector: 'pi-formulario-slot',
  imports: [
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ datosDialogo.slot ? 'Editar slot ' + datosDialogo.slot.codigo : 'Nuevo slot' }}
    </h2>
    <form (submit)="guardar($event)" novalidate>
      <mat-dialog-content>
        @if (error(); as mensaje) {
          <p class="mensaje-error" role="alert">{{ mensaje }}</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>Bodega</mat-label>
          <mat-select [formField]="formulario.bodegaId">
            @for (b of catalogo.bodegas.value() ?? []; track b.id) {
              <mat-option [value]="b.id">{{ b.codigo }} · {{ b.descripcion }}</mat-option>
            }
          </mat-select>
          @for (e of formulario.bodegaId().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Código</mat-label>
          <input matInput autocomplete="off" [formField]="formulario.codigo" />
          <mat-hint>Ej. A-01, ESTANTE-3. Se guarda en mayúsculas.</mat-hint>
          @for (e of formulario.codigo().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Descripción (opcional)</mat-label>
          <input matInput [formField]="formulario.descripcion" />
          @for (e of formulario.descripcion().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
        @if (datosDialogo.slot) {
          <mat-checkbox [formField]="formulario.activo">Activo</mat-checkbox>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit">Guardar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
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
export class FormularioSlot {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<FormularioSlot, SlotDto>);
  protected readonly catalogo = inject(CatalogoInventario);
  protected readonly datosDialogo = inject<DatosFormularioSlot>(MAT_DIALOG_DATA);

  protected readonly datos = signal<Modelo>({
    bodegaId: this.datosDialogo.slot?.bodegaId ?? this.datosDialogo.bodegaId ?? null,
    codigo: this.datosDialogo.slot?.codigo ?? '',
    descripcion: this.datosDialogo.slot?.descripcion ?? '',
    activo: this.datosDialogo.slot?.activo ?? true,
  });
  // Mismas reglas que el backend (SlotRequestDTO)
  protected readonly formulario = form(this.datos, (d) => {
    required(d.bodegaId, { message: 'Elija la bodega.' });
    required(d.codigo, { message: 'Ingrese el código.' });
    maxLength(d.codigo, 30, { message: 'Máximo 30 caracteres.' });
    maxLength(d.descripcion, 100, { message: 'Máximo 100 caracteres.' });
  });
  protected readonly error = signal<string | null>(null);

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const d = this.datos();
      const body = {
        bodegaId: d.bodegaId ?? 0,
        codigo: d.codigo.trim(),
        descripcion: d.descripcion.trim() || undefined,
        activo: d.activo,
      };
      const contexto = new HttpContext().set(MANEJA_ERRORES, true);
      try {
        const slot = this.datosDialogo.slot
          ? await this.api.invoke(
              inventarioActualizarSlot,
              { id: this.datosDialogo.slot.id ?? 0, body },
              contexto,
            )
          : await this.api.invoke(inventarioCrearSlot, { body }, contexto);
        this.dialogo.close(slot);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
