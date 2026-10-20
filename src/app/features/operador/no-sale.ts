import { HttpContext } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { pedidoDetalleDevolverLinea } from '../../api/fn/lineas-de-pedido/pedido-detalle-devolver-linea';
import { pedidoDetalleMarcarNoSale } from '../../api/fn/lineas-de-pedido/pedido-detalle-marcar-no-sale';
import { LineaColaDto } from '../../api/models/linea-cola-dto';
import { MovimientoNoSaleResponseDto } from '../../api/models/movimiento-no-sale-response-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { EstadoChip } from '../../core/ui/estado-chip';

/** Código del estado de línea "No sale" (V11): el supervisor entra y sale de él con este diálogo. */
export const CODIGO_NO_SALE = 'NO_SALE';

export interface DatosNoSale {
  linea: LineaColaDto;
  /** marcar: la línea no se despacha; devolver: vuelve a la etapa en que estaba. */
  accion: 'marcar' | 'devolver';
}

/** Mensaje para el aviso al cerrar, incluido lo que pasó con el pedido (anulado o reabierto). */
export function mensajeNoSale(datos: DatosNoSale, r: MovimientoNoSaleResponseDto): string {
  const { linea, accion } = datos;
  const base =
    accion === 'marcar'
      ? `Pedido ${linea.numeroPedido}, pos. ${linea.posicion}: quedó en No sale.`
      : `Pedido ${linea.numeroPedido}, pos. ${linea.posicion}: volvió a ${r.linea?.estadoActual?.nombre}.`;
  if (!r.cambioEstadoPedido) {
    return base;
  }
  return accion === 'marcar'
    ? `${base} El pedido quedó ${r.estadoPedido?.nombre?.toLowerCase()}: todas sus líneas están en No sale.`
    : `${base} El pedido se reabrió en ${r.estadoPedido?.nombre}.`;
}

/**
 * Supervisor: marca una línea como No sale (no disponibilidad del producto) o la devuelve a su etapa, siempre con
 * justificación. Si todas las líneas del pedido quedan en No sale, el backend lo anula; al devolver una, lo reabre.
 */
@Component({
  selector: 'pi-no-sale',
  imports: [
    EstadoChip,
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './no-sale.html',
  styleUrl: './corregir-cantidad.scss',
})
export class NoSale {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<NoSale, MovimientoNoSaleResponseDto>);
  protected readonly datosDialogo = inject<DatosNoSale>(MAT_DIALOG_DATA);
  protected readonly linea = this.datosDialogo.linea;
  protected readonly marcar = this.datosDialogo.accion === 'marcar';

  protected readonly datos = signal({ justificacion: '' });
  // Mismas reglas que el backend (JustificacionRequestDTO)
  protected readonly formulario = form(this.datos, (d) => {
    required(d.justificacion, {
      message: this.marcar ? 'Explique por qué no sale.' : 'Explique por qué se devuelve.',
    });
    minLength(d.justificacion, 10, { message: 'Escriba al menos 10 caracteres.' });
    maxLength(d.justificacion, 500, { message: 'Máximo 500 caracteres.' });
  });
  protected readonly error = signal<string | null>(null);

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const params = {
        id: this.linea.id ?? 0,
        body: { justificacion: this.datos().justificacion.trim() },
      };
      const contexto = new HttpContext().set(MANEJA_ERRORES, true);
      try {
        const resultado = this.marcar
          ? await this.api.invoke(pedidoDetalleMarcarNoSale, params, contexto)
          : await this.api.invoke(pedidoDetalleDevolverLinea, params, contexto);
        this.dialogo.close(resultado);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
