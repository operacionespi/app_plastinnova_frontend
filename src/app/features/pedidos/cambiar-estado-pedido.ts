import { HttpContext } from '@angular/common/http';
import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { form, FormField, maxLength, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Api } from '../../api/api';
import { estadosPedidoDestinos } from '../../api/fn/catalogo-estados-de-pedido/estados-pedido-destinos';
import { pedidoCambiarEstadoPedido } from '../../api/fn/pedidos-agregado-raiz/pedido-cambiar-estado-pedido';
import { PedidoResponseDto } from '../../api/models/pedido-response-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { EstadoChip } from '../../core/ui/estado-chip';

/** Cambia el estado general del pedido; solo ofrece las transiciones configuradas. Devuelve el pedido actualizado. */
@Component({
  selector: 'pi-cambiar-estado-pedido',
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
  templateUrl: './cambiar-estado-pedido.html',
  styleUrl: './dialogo-pedido.scss',
})
export class CambiarEstadoPedido {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<CambiarEstadoPedido, PedidoResponseDto>);
  protected readonly pedido = inject<PedidoResponseDto>(MAT_DIALOG_DATA);

  protected readonly destinos = resource({
    loader: () =>
      this.api.invoke(
        estadosPedidoDestinos,
        { id: this.pedido.estadoActual?.id ?? 0 },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly errorDestinos = computed(() =>
    this.destinos.error() ? leerProblema(this.destinos.error()).mensaje : null,
  );

  protected readonly datos = signal<{ destinoId: number | null; observaciones: string }>({
    destinoId: null,
    observaciones: '',
  });
  protected readonly formulario = form(this.datos, (d) => {
    required(d.destinoId, { message: 'Elija el nuevo estado.' });
    maxLength(d.observaciones, 500, { message: 'Máximo 500 caracteres.' });
  });
  protected readonly error = signal<string | null>(null);

  constructor() {
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
      const { destinoId, observaciones } = this.datos();
      try {
        const actualizado = await this.api.invoke(
          pedidoCambiarEstadoPedido,
          {
            id: this.pedido.id ?? 0,
            body: {
              nuevoEstadoId: destinoId ?? 0,
              observaciones: observaciones.trim() || undefined,
            },
          },
          new HttpContext().set(MANEJA_ERRORES, true),
        );
        this.dialogo.close(actualizado);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
