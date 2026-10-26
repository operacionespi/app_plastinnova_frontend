import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { form, FormField, maxLength } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { remisionAnular } from '../../api/fn/entregas/remision-anular';
import { remisionEmitir } from '../../api/fn/entregas/remision-emitir';
import { remisionEntregasPedido } from '../../api/fn/entregas/remision-entregas-pedido';
import { LineaEntregaDto } from '../../api/models/linea-entrega-dto';
import { RemisionDto } from '../../api/models/remision-dto';
import { Sesion } from '../../core/auth/sesion';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { Avisos } from '../../core/ui/avisos';
import { EstadoChip } from '../../core/ui/estado-chip';
import { UtcPipe } from '../../core/ui/fechas';
import { DatosJustificacion, Justificacion } from '../../core/ui/justificacion';
import { NOMBRE_ESTADO_REMISION } from './entregas';

/**
 * Entregas de un pedido: por línea lo entregado, lo que falta y lo disponible en la bodega de producto terminado, y
 * el formulario para emitir una remisión. Las líneas que completan lo solicitado pasan solas a Entregado.
 */
@Component({
  selector: 'pi-entregas-pedido',
  imports: [
    DatePipe,
    DecimalPipe,
    EstadoChip,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
    RouterLink,
    UtcPipe,
  ],
  templateUrl: './entregas-pedido.html',
  styleUrl: './entregas-pedido.scss',
})
export class EntregasPedido {
  private readonly api = inject(Api);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);

  /** Parámetro de la ruta. */
  readonly id = input.required<string>();

  protected readonly puedeEmitir = inject(Sesion).tienePermiso(PERMISOS.gestionarEntregas);
  protected readonly nombreEstado = NOMBRE_ESTADO_REMISION;
  protected readonly columnas = computed(() => [
    'producto',
    'etapa',
    'solicitada',
    'entregada',
    'disponible',
    ...(this.puedeEmitir && !this.entregas.value()?.motivoCerrado ? ['entregar'] : []),
  ]);

  protected readonly entregas = resource({
    params: () => ({ id: Number(this.id()) }),
    loader: ({ params }) =>
      this.api.invoke(remisionEntregasPedido, params, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly error = computed(() =>
    this.entregas.error() ? leerProblema(this.entregas.error()) : null,
  );

  /** Piezas a entregar por línea (detalleId → cantidad). */
  protected readonly cantidades = signal<Record<number, number>>({});
  protected readonly totalPiezas = computed(() =>
    Object.values(this.cantidades()).reduce((t, c) => t + (c > 0 ? c : 0), 0),
  );
  protected readonly datos = signal({ transportador: '', placa: '', observaciones: '' });
  protected readonly formulario = form(this.datos, (d) => {
    maxLength(d.transportador, 150, { message: 'Máximo 150 caracteres.' });
    maxLength(d.placa, 20, { message: 'Máximo 20 caracteres.' });
    maxLength(d.observaciones, 500, { message: 'Máximo 500 caracteres.' });
  });
  protected readonly emitiendo = signal(false);
  protected readonly errorEmision = signal<string | null>(null);

  protected cambiarCantidad(l: LineaEntregaDto, valor: number): void {
    const cantidad = Number.isFinite(valor) ? Math.trunc(valor) : 0;
    this.cantidades.update((c) => ({ ...c, [l.detalleId ?? 0]: cantidad }));
  }

  protected cantidad(l: LineaEntregaDto): number {
    return this.cantidades()[l.detalleId ?? 0] ?? 0;
  }

  protected excede(l: LineaEntregaDto): boolean {
    return this.cantidad(l) > (l.maximoEntregable ?? 0) || this.cantidad(l) < 0;
  }

  /** Llena cada línea con lo máximo que puede entregar ahora. */
  protected todo(): void {
    const c: Record<number, number> = {};
    for (const l of this.entregas.value()?.lineas ?? []) {
      if (!l.motivoNoEntregable && l.maximoEntregable) {
        c[l.detalleId ?? 0] = l.maximoEntregable;
      }
    }
    this.cantidades.set(c);
  }

  protected async emitir(evento: Event): Promise<void> {
    evento.preventDefault();
    this.errorEmision.set(null);
    const lineas = this.entregas.value()?.lineas ?? [];
    const conExceso = lineas.find((l) => this.cantidad(l) && this.excede(l));
    if (conExceso) {
      this.errorEmision.set(
        `Línea ${conExceso.posicion}: puede entregar hasta ${conExceso.maximoEntregable} piezas.`,
      );
      return;
    }
    if (!this.totalPiezas() || !this.formulario().valid()) {
      this.errorEmision.set('Indique las piezas a entregar de al menos una línea.');
      return;
    }
    const d = this.datos();
    this.emitiendo.set(true);
    try {
      const remision = await this.api.invoke(
        remisionEmitir,
        {
          id: Number(this.id()),
          body: {
            transportador: d.transportador.trim() || undefined,
            placa: d.placa.trim() || undefined,
            observaciones: d.observaciones.trim() || undefined,
            lineas: Object.entries(this.cantidades())
              .filter(([, cantidad]) => cantidad > 0)
              .map(([detalleId, cantidad]) => ({ detalleId: Number(detalleId), cantidad })),
          },
        },
        new HttpContext().set(MANEJA_ERRORES, true),
      );
      this.avisos.exito(
        `Remisión ${remision.numero} emitida: ${remision.totalPiezas} piezas salieron de la bodega.`,
      );
      this.cantidades.set({});
      this.datos.set({ transportador: '', placa: '', observaciones: '' });
      this.entregas.reload();
    } catch (e) {
      this.errorEmision.set(leerProblema(e).mensaje);
    } finally {
      this.emitiendo.set(false);
    }
  }

  protected anular(r: RemisionDto): void {
    this.dialogos
      .open<Justificacion, DatosJustificacion, RemisionDto>(Justificacion, {
        data: {
          titulo: `Anular ${r.numero}`,
          mensaje:
            'El producto vuelve a los slots de donde salió y queda comprometido otra vez para sus líneas; las que estaban en Entregado regresan a su etapa.',
          accion: 'Anular remisión',
          ejecutar: (justificacion) =>
            this.api.invoke(
              remisionAnular,
              { id: r.id ?? 0, body: { justificacion } },
              new HttpContext().set(MANEJA_ERRORES, true),
            ),
        },
        width: '520px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((anulada) => {
        if (anulada) {
          this.avisos.exito(`${anulada.numero} anulada.`);
          this.entregas.reload();
        }
      });
  }
}
