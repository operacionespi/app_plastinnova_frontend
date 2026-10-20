import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, resource } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Api } from '../../api/api';
import { pedidoDetalleObtenerHistorial } from '../../api/fn/lineas-de-pedido/pedido-detalle-obtener-historial';
import { LineaColaDto } from '../../api/models/linea-cola-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { UtcPipe } from '../../core/ui/fechas';
import { EstadoChip } from '../../core/ui/estado-chip';

/** Cambios de estado de la línea, del más reciente al más antiguo. */
@Component({
  selector: 'pi-historial-linea',
  imports: [
    DatePipe,
    DecimalPipe,
    EstadoChip,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
    UtcPipe,
  ],
  templateUrl: './historial-linea.html',
  styleUrl: './historial-linea.scss',
})
export class HistorialLinea {
  private readonly api = inject(Api);
  protected readonly linea = inject<LineaColaDto>(MAT_DIALOG_DATA);

  protected readonly historial = resource({
    loader: () =>
      this.api.invoke(
        pedidoDetalleObtenerHistorial,
        { id: this.linea.id ?? 0 },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly error = computed(() =>
    this.historial.error() ? leerProblema(this.historial.error()).mensaje : null,
  );
}
