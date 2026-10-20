import { HttpContext } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Api } from '../../api/api';
import { estadosDetalleListar } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-listar';
import { pedidoDetalleBuscarLineas } from '../../api/fn/lineas-de-pedido/pedido-detalle-buscar-lineas';
import { EstadoCatalogoResponseDto } from '../../api/models/estado-catalogo-response-dto';
import { FiltroLineaRequestDto } from '../../api/models/filtro-linea-request-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { ListaLineas } from './lista-lineas';
import { Alistamiento, guardarPreferenciasCola, leerPreferenciasCola } from './preferencias-cola';

/** Pantalla principal del operador: las líneas pendientes de la etapa que elige en la tablet. */
@Component({
  selector: 'pi-cola-trabajo',
  imports: [
    ListaLineas,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './cola-trabajo.html',
  styleUrl: './cola-trabajo.scss',
})
export class ColaTrabajo {
  private readonly api = inject(Api);
  private readonly lista = viewChild(ListaLineas);
  private readonly preferencias = leerPreferenciasCola();

  protected readonly catalogo = resource({
    loader: () =>
      this.api.invoke(estadosDetalleListar, {}, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly errorCatalogo = computed(() =>
    this.catalogo.error() ? leerProblema(this.catalogo.error()).mensaje : null,
  );

  /** Las etapas son los estados activos que no son finales (lo entregado ya no está en la cola). */
  protected readonly etapas = computed(() =>
    (this.catalogo.value() ?? [])
      .filter((e) => !e.esFinal)
      .sort((a, b) => (a.ordenLogico ?? 0) - (b.ordenLogico ?? 0)),
  );

  /** La etapa guardada si sigue existiendo; si no, la primera del proceso. */
  protected readonly etapaId = linkedSignal<EstadoCatalogoResponseDto[], number | undefined>({
    source: this.etapas,
    computation: (etapas, previo) => {
      const deseada = previo?.value ?? this.preferencias.etapaId;
      return etapas.some((e) => e.id === deseada) ? deseada : etapas[0]?.id;
    },
  });
  protected readonly alistamiento = signal<Alistamiento>(this.preferencias.alistamiento);

  protected readonly filtro = computed<FiltroLineaRequestDto | undefined>(() => {
    const etapaId = this.etapaId();
    const alistamiento = this.alistamiento();
    if (etapaId === undefined) {
      return undefined;
    }
    return {
      estadosIds: [etapaId],
      tipoAlistamiento: alistamiento === 'TODOS' ? undefined : alistamiento,
    };
  });

  protected readonly nombreEtapa = computed(
    () => this.etapas().find((e) => e.id === this.etapaId())?.nombre ?? '',
  );

  /** Líneas pendientes por etapa: una consulta de una sola fila por etapa (solo interesa el total). */
  protected readonly conteos = resource({
    params: () => {
      const etapas = this.etapas();
      return etapas.length ? { etapas, alistamiento: this.alistamiento() } : undefined;
    },
    loader: async ({ params }) => {
      const tipoAlistamiento = params.alistamiento === 'TODOS' ? undefined : params.alistamiento;
      const totales = await Promise.all(
        params.etapas.map((etapa) =>
          this.api
            .invoke(
              pedidoDetalleBuscarLineas,
              {
                pageable: { page: 0, size: 1 },
                body: { estadosIds: [etapa.id!], tipoAlistamiento },
              },
              new HttpContext().set(MANEJA_ERRORES, true),
            )
            .then((r) => [etapa.id!, r.page?.totalElements ?? 0] as const),
        ),
      );
      return new Map<number, number>(totales);
    },
  });

  constructor() {
    effect(() => {
      guardarPreferenciasCola({ etapaId: this.etapaId(), alistamiento: this.alistamiento() });
    });
  }

  protected actualizar(): void {
    this.lista()?.recargar();
    this.conteos.reload();
  }

  protected conteo(etapaId: number | undefined): string {
    const total = etapaId === undefined ? undefined : this.conteos.value()?.get(etapaId);
    return total === undefined ? '' : String(total);
  }
}
