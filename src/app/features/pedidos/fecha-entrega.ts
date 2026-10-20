import { HttpContext } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { pedidoAsignarFechaEstimadaEntrega } from '../../api/fn/pedidos-agregado-raiz/pedido-asignar-fecha-estimada-entrega';
import { PedidoResponseDto } from '../../api/models/pedido-response-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';

/** Asigna, cambia o quita el día comprometido de entrega. Queda auditado en el backend. */
@Component({
  selector: 'pi-fecha-entrega',
  imports: [FormField, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  templateUrl: './fecha-entrega.html',
  styleUrl: './dialogo-pedido.scss',
})
export class FechaEntrega {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<FechaEntrega, PedidoResponseDto>);
  protected readonly pedido = inject<PedidoResponseDto>(MAT_DIALOG_DATA);

  protected readonly datos = signal({ fecha: this.pedido.fechaEstimadaEntrega ?? '' });
  protected readonly formulario = form(this.datos, (d) => {
    required(d.fecha, { message: 'Elija el día de entrega.' });
  });
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    await submit(this.formulario, async () => {
      await this.enviar(this.datos().fecha);
      return undefined;
    });
  }

  protected async quitar(): Promise<void> {
    this.guardando.set(true);
    await this.enviar(undefined);
    this.guardando.set(false);
  }

  private async enviar(fecha: string | undefined): Promise<void> {
    this.error.set(null);
    try {
      const actualizado = await this.api.invoke(
        pedidoAsignarFechaEstimadaEntrega,
        { id: this.pedido.id ?? 0, body: { fechaEstimadaEntrega: fecha } },
        new HttpContext().set(MANEJA_ERRORES, true),
      );
      this.dialogo.close(actualizado);
    } catch (e) {
      this.error.set(leerProblema(e).mensaje);
    }
  }
}
