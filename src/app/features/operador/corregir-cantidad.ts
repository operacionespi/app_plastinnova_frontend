import { HttpContext } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  max,
  maxLength,
  min,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { pedidoDetalleCorregirCantidad } from '../../api/fn/lineas-de-pedido/pedido-detalle-corregir-cantidad';
import { LineaColaDto } from '../../api/models/linea-cola-dto';
import { PedidoDetalleResponseDto } from '../../api/models/pedido-detalle-response-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { EstadoChip } from '../../core/ui/estado-chip';

/**
 * Supervisor: corrige las piezas que reportó la etapa anterior (ej. se contaron de menos y la etapa actual no puede
 * reportar las que realmente llegaron). No cambia la etapa; la justificación queda en el historial.
 */
@Component({
  selector: 'pi-corregir-cantidad',
  imports: [
    EstadoChip,
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './corregir-cantidad.html',
  styleUrl: './corregir-cantidad.scss',
})
export class CorregirCantidad {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<CorregirCantidad, PedidoDetalleResponseDto>);
  protected readonly linea = inject<LineaColaDto>(MAT_DIALOG_DATA);
  protected readonly actual = this.linea.cantidadProcesada ?? 0;
  protected readonly solicitada = this.linea.cantidadSolicitada ?? 0;

  protected readonly datos = signal<{ cantidad: number | null; justificacion: string }>({
    cantidad: this.actual,
    justificacion: '',
  });
  // Mismas reglas que el backend (CorreccionCantidadRequestDTO)
  protected readonly formulario = form(this.datos, (d) => {
    required(d.cantidad, { message: 'Ingrese la cantidad correcta.' });
    min(d.cantidad, 0, { message: 'No puede ser negativa.' });
    max(d.cantidad, this.solicitada, { message: `No puede superar ${this.solicitada}.` });
    validate(d.cantidad, ({ value }) =>
      value() === this.actual
        ? { kind: 'sinCambio', message: 'Es la misma cantidad que ya está reportada.' }
        : undefined,
    );
    required(d.justificacion, { message: 'Explique por qué se corrige.' });
    minLength(d.justificacion, 10, { message: 'Escriba al menos 10 caracteres.' });
    maxLength(d.justificacion, 500, { message: 'Máximo 500 caracteres.' });
  });
  protected readonly error = signal<string | null>(null);

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const { cantidad, justificacion } = this.datos();
      try {
        const actualizada = await this.api.invoke(
          pedidoDetalleCorregirCantidad,
          {
            id: this.linea.id ?? 0,
            body: { cantidadProcesada: cantidad ?? 0, justificacion: justificacion.trim() },
          },
          new HttpContext().set(MANEJA_ERRORES, true),
        );
        this.dialogo.close(actualizada);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
