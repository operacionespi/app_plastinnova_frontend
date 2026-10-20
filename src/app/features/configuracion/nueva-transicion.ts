import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Api } from '../../api/api';
import { EstadoCatalogoResponseDto } from '../../api/models/estado-catalogo-response-dto';
import { TransicionResponseDto } from '../../api/models/transicion-response-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { API_ESTADOS, TipoCatalogo } from './api-estados';

export interface DatosNuevaTransicion {
  tipo: TipoCatalogo;
  /** Solo estados activos: el backend no permite transiciones con inactivos. */
  estados: EstadoCatalogoResponseDto[];
  transiciones: TransicionResponseDto[];
  origenId?: number;
}

/** Permite pasar de un estado a otro. Devuelve la transición creada. */
@Component({
  selector: 'pi-nueva-transicion',
  imports: [FormField, MatButtonModule, MatDialogModule, MatFormFieldModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Nueva transición</h2>
    <form (submit)="guardar($event)" novalidate>
      <mat-dialog-content>
        @if (error(); as mensaje) {
          <p class="mensaje-error" role="alert">{{ mensaje }}</p>
        }
        <mat-form-field appearance="outline" class="ancho">
          <mat-label>Desde</mat-label>
          <mat-select [formField]="formulario.origenId">
            @for (e of datosDialogo.estados; track e.id) {
              <mat-option [value]="e.id">{{ e.nombre }}</mat-option>
            }
          </mat-select>
          @for (e of formulario.origenId().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="ancho">
          <mat-label>Hacia</mat-label>
          <mat-select [formField]="formulario.destinoId">
            @for (e of destinosPosibles(); track e.id) {
              <mat-option [value]="e.id">{{ e.nombre }}</mat-option>
            }
          </mat-select>
          @for (e of formulario.destinoId().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit" [disabled]="formulario().submitting()">
          Agregar
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './dialogo-configuracion.scss',
})
export class NuevaTransicion {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<NuevaTransicion, TransicionResponseDto>);
  protected readonly datosDialogo = inject<DatosNuevaTransicion>(MAT_DIALOG_DATA);

  protected readonly datos = signal<{ origenId: number | null; destinoId: number | null }>({
    origenId: this.datosDialogo.origenId ?? null,
    destinoId: null,
  });
  protected readonly formulario = form(this.datos, (d) => {
    required(d.origenId, { message: 'Elija el estado de origen.' });
    required(d.destinoId, { message: 'Elija el estado de destino.' });
  });

  /** Sin el origen ni los destinos que ya tiene. */
  protected readonly destinosPosibles = computed(() => {
    const origen = this.datos().origenId;
    const existentes = new Set(
      this.datosDialogo.transiciones
        .filter((t) => t.estadoOrigen?.id === origen)
        .map((t) => t.estadoDestino?.id),
    );
    return this.datosDialogo.estados.filter((e) => e.id !== origen && !existentes.has(e.id));
  });
  protected readonly error = signal<string | null>(null);

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const { origenId, destinoId } = this.datos();
      try {
        const creada = await this.api.invoke(
          API_ESTADOS[this.datosDialogo.tipo].crearTransicion,
          { body: { estadoOrigenId: origenId ?? 0, estadoDestinoId: destinoId ?? 0 } },
          new HttpContext().set(MANEJA_ERRORES, true),
        );
        this.dialogo.close(creada);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
