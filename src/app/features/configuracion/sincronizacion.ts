import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../api/api';
import { sincronizacionEjecutar } from '../../api/fn/sincronizacion-file-maker/sincronizacion-ejecutar';
import { sincronizacionListar } from '../../api/fn/sincronizacion-file-maker/sincronizacion-listar';
import { SyncLogResponseDto } from '../../api/models/sync-log-response-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { Avisos } from '../../core/ui/avisos';
import { Confirmacion, DatosConfirmacion } from '../../core/ui/confirmacion';
import { instanteUtc, UtcPipe } from '../../core/ui/fechas';
import { DetalleEjecucion } from './detalle-ejecucion';

type Modo = NonNullable<SyncLogResponseDto['modo']>;

export const NOMBRE_MODO: Record<Modo, string> = {
  INCREMENTAL: 'Incremental',
  RECONCILIACION: 'Reconciliación',
  COMPLETA: 'Completa',
};
export const NOMBRE_ESTADO: Record<NonNullable<SyncLogResponseDto['estado']>, string> = {
  EN_PROCESO: 'En proceso',
  EXITO: 'Exitosa',
  PARCIAL: 'Con errores',
  ERROR: 'Fallida',
};
const EJECUCIONES_POR_PAGINA = 20;
/** Mientras hay una ejecución en curso la bitácora se consulta cada pocos segundos. */
const INTERVALO_SEGUIMIENTO_MS = 3000;

/** Duración legible: "45 s", "3 min 35 s". */
export function duracion(inicio?: string, fin?: string): string {
  if (!inicio || !fin) {
    return '—';
  }
  const segundos = Math.max(
    0,
    Math.round((instanteUtc(fin).getTime() - instanteUtc(inicio).getTime()) / 1000),
  );
  return segundos < 60 ? `${segundos} s` : `${Math.floor(segundos / 60)} min ${segundos % 60} s`;
}

/** Coordinación: bitácora de la sincronización con FileMaker y ejecución manual. */
@Component({
  selector: 'pi-sincronizacion',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    UtcPipe,
  ],
  templateUrl: './sincronizacion.html',
  styleUrl: './sincronizacion.scss',
})
export class Sincronizacion {
  private readonly api = inject(Api);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);

  protected readonly nombreModo = NOMBRE_MODO;
  protected readonly nombreEstado = NOMBRE_ESTADO;
  protected readonly duracion = duracion;
  protected readonly pagina = signal(0);
  protected readonly iniciando = signal(false);

  protected readonly ejecuciones = resource({
    params: () => ({ pagina: this.pagina(), tamano: EJECUCIONES_POR_PAGINA }),
    loader: ({ params }) =>
      this.api.invoke(sincronizacionListar, params, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly error = computed(() =>
    this.ejecuciones.error() ? leerProblema(this.ejecuciones.error()).mensaje : null,
  );
  protected readonly total = computed(() => this.ejecuciones.value()?.page?.totalElements ?? 0);
  /** La bitácora viene de la más reciente a la más antigua: basta con mirar la primera de la primera página. */
  protected readonly enCurso = computed(() => {
    const primera = this.pagina() === 0 ? this.ejecuciones.value()?.content?.[0] : undefined;
    return primera?.estado === 'EN_PROCESO' ? primera : null;
  });

  protected readonly columnas = [
    'fechaInicio',
    'modo',
    'estado',
    'duracion',
    'leidos',
    'cambios',
    'omitidos',
    'disparadoPor',
    'detalle',
  ];

  constructor() {
    // Seguimiento mientras corre: al terminar, la bitácora deja de consultarse sola
    effect((onCleanup) => {
      if (!this.enCurso()) {
        return;
      }
      const temporizador = setTimeout(() => this.ejecuciones.reload(), INTERVALO_SEGUIMIENTO_MS);
      onCleanup(() => clearTimeout(temporizador));
    });
  }

  protected async ejecutar(modo: Modo): Promise<void> {
    if (modo === 'COMPLETA') {
      const confirmado = await firstValueFrom(
        this.dialogos
          .open<Confirmacion, DatosConfirmacion, boolean>(Confirmacion, {
            width: '480px',
            data: {
              titulo: 'Sincronización completa',
              mensaje:
                'Vuelve a leer de FileMaker todo desde la fecha de corte. Tarda varios minutos y mientras ' +
                'tanto no se puede iniciar otra sincronización. Normalmente basta con la incremental.',
              accion: 'Ejecutar completa',
            },
          })
          .afterClosed(),
      );
      if (!confirmado) {
        return;
      }
    }
    this.iniciando.set(true);
    try {
      const bitacora = await this.api.invoke(
        sincronizacionEjecutar,
        { modo },
        new HttpContext().set(MANEJA_ERRORES, true),
      );
      this.avisos.exito(
        `Sincronización ${NOMBRE_MODO[bitacora.modo ?? modo].toLowerCase()} iniciada.`,
      );
    } catch (e) {
      this.avisos.error(leerProblema(e).mensaje);
    }
    this.iniciando.set(false);
    this.pagina.set(0);
    this.ejecuciones.reload();
  }

  // Las filas de mat-table no tienen tipo en la plantilla
  protected textoModo(e: SyncLogResponseDto): string {
    return e.modo ? NOMBRE_MODO[e.modo] : '—';
  }

  protected textoResultado(e: SyncLogResponseDto): string {
    return e.estado ? NOMBRE_ESTADO[e.estado] : '—';
  }

  protected verDetalle(ejecucion: SyncLogResponseDto): void {
    this.dialogos.open(DetalleEjecucion, { data: ejecucion, width: '720px', maxWidth: '95vw' });
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
  }
}
