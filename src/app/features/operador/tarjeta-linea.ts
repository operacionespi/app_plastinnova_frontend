import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { LineaColaDto } from '../../api/models/linea-cola-dto';
import { DiaPipe } from '../../core/ui/fechas';
import { EstadoChip } from '../../core/ui/estado-chip';

/** Una línea de pedido en la tablet: lo necesario para ubicarla en planta y reportar su avance. */
@Component({
  selector: 'pi-tarjeta-linea',
  imports: [
    DatePipe,
    DecimalPipe,
    DiaPipe,
    EstadoChip,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
  ],
  templateUrl: './tarjeta-linea.html',
  styleUrl: './tarjeta-linea.scss',
})
export class TarjetaLinea {
  readonly linea = input.required<LineaColaDto>();
  /** Sin permiso de reportar avance (ej. supervisor de solo consulta) no se muestra el botón. */
  readonly puedeReportar = input(true);
  /** Supervisor (detalle:corregir-cantidad): corrige las piezas de la etapa anterior, con justificación. */
  readonly puedeCorregir = input(false);
  /** Supervisor (detalle:no-sale): la línea no se despacha por no disponibilidad del producto. */
  readonly puedeMarcarNoSale = input(false);
  readonly reportar = output<LineaColaDto>();
  readonly corregir = output<LineaColaDto>();
  readonly noSale = output<LineaColaDto>();
  readonly historial = output<LineaColaDto>();

  protected readonly idTitulo = computed(() => `linea-${this.linea().id}`);
  protected readonly porcentaje = computed(() => {
    const { cantidadProcesada = 0, cantidadSolicitada = 0 } = this.linea();
    return cantidadSolicitada > 0
      ? Math.min(100, (cantidadProcesada / cantidadSolicitada) * 100)
      : 0;
  });
}
