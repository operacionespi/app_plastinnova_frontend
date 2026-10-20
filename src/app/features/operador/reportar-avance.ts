import { HttpContext } from '@angular/common/http';
import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { form, FormField, max, maxLength, min, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Api } from '../../api/api';
import { estadosDetalleDestinos } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-destinos';
import { pedidoDetalleCambiarEstadoDetalle } from '../../api/fn/lineas-de-pedido/pedido-detalle-cambiar-estado-detalle';
import { LineaColaDto } from '../../api/models/linea-cola-dto';
import { PedidoDetalleResponseDto } from '../../api/models/pedido-detalle-response-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { EstadoChip } from '../../core/ui/estado-chip';

interface Reporte {
  destinoId: number | null;
  cantidad: number | null;
  observaciones: string;
}

/**
 * Pasa la línea a la siguiente etapa y reporta las piezas procesadas en la etapa actual.
 * Solo ofrece los destinos configurados para el estado actual (transiciones del catálogo).
 * Al cerrar devuelve la línea actualizada, o nada si se canceló o falló.
 */
@Component({
  selector: 'pi-reportar-avance',
  imports: [
    EstadoChip,
    FormField,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './reportar-avance.html',
  styleUrl: './reportar-avance.scss',
})
export class ReportarAvance {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<ReportarAvance, PedidoDetalleResponseDto>);
  protected readonly linea = inject<LineaColaDto>(MAT_DIALOG_DATA);
  protected readonly solicitada = this.linea.cantidadSolicitada ?? 0;
  /** Las piezas avanzan de etapa en etapa: no se reporta más de lo que reportó la etapa anterior. */
  protected readonly limite = this.linea.cantidadMaximaReporte ?? this.solicitada;
  protected readonly limitadaPorEtapaAnterior = !!this.linea.avanceReportado;

  protected readonly destinos = resource({
    loader: () =>
      this.api.invoke(
        estadosDetalleDestinos,
        { id: this.linea.estadoActual?.id ?? 0 },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly errorDestinos = computed(() =>
    this.destinos.error() ? leerProblema(this.destinos.error()).mensaje : null,
  );

  // Por defecto pasan todas las piezas que llegaron: es el caso normal al terminar una etapa
  protected readonly datos = signal<Reporte>({
    destinoId: null,
    cantidad: this.limite,
    observaciones: '',
  });
  protected readonly formulario = form(this.datos, (d) => {
    required(d.destinoId, { message: 'Elija la etapa a la que pasa la línea.' });
    required(d.cantidad, { message: 'Ingrese las piezas procesadas.' });
    // Mismas reglas que el backend (CambioEstadoDetalleRequestDTO y el tope de la línea)
    min(d.cantidad, 0, { message: 'No puede ser negativa.' });
    max(d.cantidad, this.limite, {
      message: this.limitadaPorEtapaAnterior
        ? `No puede superar ${this.limite}: es lo que reportó la etapa anterior.`
        : `No puede superar ${this.limite}.`,
    });
    maxLength(d.observaciones, 500, { message: 'Máximo 500 caracteres.' });
  });
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Con un solo destino posible no hay nada que elegir
    effect(() => {
      const destinos = this.destinos.value();
      if (destinos?.length === 1 && this.datos().destinoId === null) {
        this.elegirDestino(destinos[0].id ?? null);
      }
    });
  }

  protected elegirDestino(id: number | null): void {
    this.datos.update((d) => ({ ...d, destinoId: id }));
  }

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const { destinoId, cantidad, observaciones } = this.datos();
      try {
        const actualizada = await this.api.invoke(
          pedidoDetalleCambiarEstadoDetalle,
          {
            id: this.linea.id ?? 0,
            body: {
              nuevoEstadoId: destinoId ?? 0,
              cantidadProcesada: cantidad ?? 0,
              observaciones: observaciones.trim() || undefined,
            },
          },
          new HttpContext().set(MANEJA_ERRORES, true),
        );
        this.dialogo.close(actualizada);
      } catch (e) {
        const problema = leerProblema(e);
        // 409: otro usuario la cambió, se eliminó en FileMaker o la transición ya no es válida
        this.error.set(
          problema.estado === 409
            ? `${problema.mensaje} Cierre esta ventana para ver la línea actualizada.`
            : problema.mensaje,
        );
      }
      return undefined;
    });
  }
}
