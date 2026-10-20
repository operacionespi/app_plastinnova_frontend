import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, output, resource } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Api } from '../../api/api';
import { pedidoDetalleBuscarLineas } from '../../api/fn/lineas-de-pedido/pedido-detalle-buscar-lineas';
import { FiltroLineaRequestDto } from '../../api/models/filtro-linea-request-dto';
import { LineaColaDto } from '../../api/models/linea-cola-dto';
import { Sesion } from '../../core/auth/sesion';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { Avisos } from '../../core/ui/avisos';
import { CorregirCantidad } from './corregir-cantidad';
import { DatosNoSale, mensajeNoSale, NoSale } from './no-sale';
import { HistorialLinea } from './historial-linea';
import { ReportarAvance } from './reportar-avance';
import { TarjetaLinea } from './tarjeta-linea';

export const LINEAS_POR_PAGINA = 20;

/** Líneas pendientes que cumplen el filtro, paginadas, con las acciones de reportar avance e historial. */
@Component({
  selector: 'pi-lista-lineas',
  imports: [MatButtonModule, MatPaginatorModule, MatProgressBarModule, TarjetaLinea],
  templateUrl: './lista-lineas.html',
  styleUrl: './lista-lineas.scss',
})
export class ListaLineas {
  private readonly api = inject(Api);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);

  /** Sin filtro no se consulta nada (ej. búsqueda aún vacía). */
  readonly filtro = input<FiltroLineaRequestDto>();
  readonly mensajeVacio = input('No hay líneas pendientes.');
  /** Una línea cambió de estado: la pantalla puede actualizar sus contadores. */
  readonly cambio = output<void>();

  private readonly sesion = inject(Sesion);
  protected readonly puedeReportar = this.sesion.tienePermiso(PERMISOS.reportarAvance);
  protected readonly puedeCorregir = this.sesion.tienePermiso(PERMISOS.corregirCantidad);
  protected readonly puedeMarcarNoSale = this.sesion.tienePermiso(PERMISOS.noSale);
  // Otro filtro vuelve a la primera página
  protected readonly pagina = linkedSignal({ source: this.filtro, computation: () => 0 });

  protected readonly lineas = resource({
    params: () => {
      const filtro = this.filtro();
      return filtro ? { filtro, pagina: this.pagina() } : undefined;
    },
    loader: ({ params }) =>
      this.api.invoke(
        pedidoDetalleBuscarLineas,
        { pageable: { page: params.pagina, size: LINEAS_POR_PAGINA }, body: params.filtro },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly error = computed(() =>
    this.lineas.error() ? leerProblema(this.lineas.error()).mensaje : null,
  );
  protected readonly total = computed(() => this.lineas.value()?.page?.totalElements ?? 0);

  recargar(): void {
    this.lineas.reload();
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
    scrollTo({ top: 0 });
  }

  protected reportar(linea: LineaColaDto): void {
    this.dialogos
      .open(ReportarAvance, { data: linea, width: '640px', maxWidth: '95vw', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((actualizada) => {
        if (actualizada) {
          this.avisos.exito(
            `Pedido ${linea.numeroPedido}, pos. ${linea.posicion}: pasó a ${actualizada.estadoActual?.nombre}.`,
          );
          this.cambio.emit();
        }
        // También tras un error de concurrencia: la línea pudo cambiar en el servidor
        this.lineas.reload();
      });
  }

  protected corregir(linea: LineaColaDto): void {
    this.dialogos
      .open(CorregirCantidad, {
        data: linea,
        width: '640px',
        maxWidth: '95vw',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .subscribe((actualizada) => {
        if (actualizada) {
          this.avisos.exito(
            `Pedido ${linea.numeroPedido}, pos. ${linea.posicion}: piezas corregidas a ${actualizada.cantidadProcesada}.`,
          );
        }
        this.lineas.reload();
      });
  }

  protected marcarNoSale(linea: LineaColaDto): void {
    const datos: DatosNoSale = { linea, accion: 'marcar' };
    this.dialogos
      .open(NoSale, { data: datos, width: '640px', maxWidth: '95vw', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((resultado) => {
        if (resultado) {
          this.avisos.exito(mensajeNoSale(datos, resultado));
          this.cambio.emit();
        }
        this.lineas.reload();
      });
  }

  protected verHistorial(linea: LineaColaDto): void {
    this.dialogos.open(HistorialLinea, { data: linea, width: '640px', maxWidth: '95vw' });
  }
}
