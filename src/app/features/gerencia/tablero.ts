import { DatePipe, DecimalPipe, formatNumber, LowerCasePipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  LOCALE_ID,
  resource,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { estadosDetalleListar } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-listar';
import { dashboardBuscarPedidos } from '../../api/fn/tablero-e-indicadores/dashboard-buscar-pedidos';
import { dashboardLineasPorEstado } from '../../api/fn/tablero-e-indicadores/dashboard-lineas-por-estado';
import { dashboardPedidosPorEstado } from '../../api/fn/tablero-e-indicadores/dashboard-pedidos-por-estado';
import { dashboardPedidosPorUbicacion } from '../../api/fn/tablero-e-indicadores/dashboard-pedidos-por-ubicacion';
import { dashboardProduccionPorOperador } from '../../api/fn/tablero-e-indicadores/dashboard-produccion-por-operador';
import { dashboardTiempoCiclo } from '../../api/fn/tablero-e-indicadores/dashboard-tiempo-ciclo';
import { dashboardTiempoEntrega } from '../../api/fn/tablero-e-indicadores/dashboard-tiempo-entrega';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { DiaPipe } from '../../core/ui/fechas';
import {
  Atajo,
  ATAJOS,
  atajoDelPeriodo,
  diasDelPeriodo,
  hoyEnPlanta,
  leerPeriodo,
  Periodo,
  periodoDeAtajo,
  porcentaje,
  proporcion,
  rangoInvalido,
} from './periodo';
import { tablaProduccion } from './produccion';
import { SeccionTablero } from './seccion-tablero';

export type Alistamiento = 'TODOS' | 'NACIONAL' | 'INTERNACIONAL';
export type NivelUbicacion = 'PAIS' | 'DEPARTAMENTO' | 'ZONA' | 'CIUDAD';

const NIVELES: readonly { valor: NivelUbicacion; etiqueta: string }[] = [
  { valor: 'PAIS', etiqueta: 'País' },
  { valor: 'DEPARTAMENTO', etiqueta: 'Departamento' },
  { valor: 'ZONA', etiqueta: 'Zona' },
  { valor: 'CIUDAD', etiqueta: 'Ciudad' },
];

/** Meta de OTIF, a tiempo y completos (definida por la empresa): por debajo se resalta en rojo. */
export const META_ENTREGAS = 80;

/** Ubicaciones visibles antes de "Ver todas". */
export const UBICACIONES_INICIALES = 10;

const SIN_AVISOS = () => new HttpContext().set(MANEJA_ERRORES, true);

/**
 * Gerencia: lo que pasa hoy en la planta (sin periodo) y los indicadores de un periodo. El periodo, las fases del
 * tiempo de ciclo, el nivel de ubicación y el alistamiento viven en la URL para poder compartir el tablero.
 */
@Component({
  selector: 'pi-tablero',
  imports: [
    DatePipe,
    DecimalPipe,
    DiaPipe,
    LowerCasePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    RouterLink,
    SeccionTablero,
  ],
  templateUrl: './tablero.html',
  styleUrl: './tablero.scss',
})
export class Tablero {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly locale = inject(LOCALE_ID);

  // Parámetros de la URL
  readonly desde = input<string>();
  readonly hasta = input<string>();
  readonly origen = input<string>();
  readonly destino = input<string>();
  readonly nivel = input<string>();
  readonly alistamiento = input<string>();

  protected readonly atajos = ATAJOS;
  protected readonly niveles = NIVELES;
  protected readonly porcentaje = porcentaje;
  protected readonly meta = META_ENTREGAS;
  protected readonly proporcion = proporcion;

  /** Se fija al abrir la pantalla: los atajos se calculan contra este día. */
  protected readonly hoy = hoyEnPlanta();
  protected readonly periodo = computed(() => leerPeriodo(this.desde(), this.hasta(), this.hoy));
  protected readonly atajo = computed(() => atajoDelPeriodo(this.periodo(), this.hoy));
  protected readonly dias = computed(() => diasDelPeriodo(this.periodo()));
  /** Fechas que el usuario está editando: solo se aplican cuando forman un rango válido. */
  protected readonly fechas = linkedSignal<Periodo>(() => this.periodo());
  protected readonly errorFechas = computed(() => rangoInvalido(this.fechas()));
  protected readonly nivelActual = computed<NivelUbicacion>(() =>
    NIVELES.some((n) => n.valor === this.nivel()) ? (this.nivel() as NivelUbicacion) : 'CIUDAD',
  );
  protected readonly alistamientoActual = computed<Alistamiento>(() => {
    const valor = this.alistamiento();
    return valor === 'NACIONAL' || valor === 'INTERNACIONAL' ? valor : 'TODOS';
  });

  // ---- Catálogo de etapas (orden del proceso y fases del tiempo de ciclo)

  protected readonly catalogo = resource({
    loader: () => this.api.invoke(estadosDetalleListar, {}, SIN_AVISOS()),
  });
  protected readonly etapas = computed(() =>
    [...(this.catalogo.value() ?? [])].sort((a, b) => (a.ordenLogico ?? 0) - (b.ordenLogico ?? 0)),
  );
  private readonly etapasFinales = computed(
    () =>
      new Set(
        this.etapas()
          .filter((e) => e.esFinal)
          .map((e) => e.id),
      ),
  );

  /** Por defecto, el tiempo total de producción: de la primera etapa después de la inicial hasta la final. */
  protected readonly origenId = computed(() => {
    const elegido = Number(this.origen());
    const etapas = this.etapas();
    return etapas.some((e) => e.id === elegido)
      ? elegido
      : (etapas.find((e) => !e.esInicial && !e.esFinal) ?? etapas[0])?.id;
  });
  protected readonly destinoId = computed(() => {
    const elegido = Number(this.destino());
    const etapas = this.etapas();
    return etapas.some((e) => e.id === elegido)
      ? elegido
      : (etapas.find((e) => e.esFinal) ?? etapas.at(-1))?.id;
  });

  // ---- Hoy

  protected readonly pedidosPorEstado = resource({
    loader: () => this.api.invoke(dashboardPedidosPorEstado, {}, SIN_AVISOS()),
  });
  protected readonly pedidosAbiertos = computed(() =>
    (this.pedidosPorEstado.value() ?? []).filter((e) => !e.esFinal),
  );
  protected readonly pedidosCerrados = computed(() =>
    (this.pedidosPorEstado.value() ?? []).filter((e) => e.esFinal),
  );
  protected readonly totalAbiertos = computed(() =>
    this.pedidosAbiertos().reduce((total, e) => total + (e.pedidos ?? 0), 0),
  );
  protected readonly maximoPedidosEstado = computed(() =>
    Math.max(0, ...this.pedidosAbiertos().map((e) => e.pedidos ?? 0)),
  );

  /** Solo interesa el total: una página de un elemento. */
  protected readonly atrasados = resource({
    loader: () =>
      this.api
        .invoke(
          dashboardBuscarPedidos,
          { pageable: { page: 0, size: 1 }, body: { soloAtrasados: true } },
          SIN_AVISOS(),
        )
        .then((pagina) => pagina.page?.totalElements ?? 0),
  });

  protected readonly lineasPorEstado = resource({
    params: () => ({ alistamiento: this.alistamientoActual() }),
    loader: ({ params }) =>
      this.api.invoke(
        dashboardLineasPorEstado,
        { tipoAlistamiento: params.alistamiento === 'TODOS' ? undefined : params.alistamiento },
        SIN_AVISOS(),
      ),
  });
  /** Lo entregado se acumula sin límite: se muestra aparte para no aplastar las barras de las etapas. */
  protected readonly lineasEnProceso = computed(() =>
    (this.lineasPorEstado.value() ?? []).filter((e) => !this.etapasFinales().has(e.estadoId)),
  );
  protected readonly lineasTerminadas = computed(() =>
    (this.lineasPorEstado.value() ?? []).filter((e) => this.etapasFinales().has(e.estadoId)),
  );
  protected readonly totalesEnProceso = computed(() => {
    let lineas = 0;
    let piezas = 0;
    for (const e of this.lineasEnProceso()) {
      lineas += e.lineas ?? 0;
      piezas += e.piezasSolicitadas ?? 0;
    }
    return { lineas, piezas };
  });
  protected readonly maximoLineasEstado = computed(() =>
    Math.max(0, ...this.lineasEnProceso().map((e) => e.lineas ?? 0)),
  );

  // ---- Periodo

  protected readonly entrega = resource({
    params: () => this.periodo(),
    loader: ({ params }) => this.api.invoke(dashboardTiempoEntrega, params, SIN_AVISOS()),
  });

  protected readonly ciclo = resource({
    params: () => {
      const origen = this.origenId();
      const destino = this.destinoId();
      return origen !== undefined && destino !== undefined && origen !== destino
        ? { ...this.periodo(), estadoOrigenId: origen, estadoDestinoId: destino }
        : undefined;
    },
    loader: ({ params }) => this.api.invoke(dashboardTiempoCiclo, params, SIN_AVISOS()),
  });

  protected readonly produccion = resource({
    params: () => this.periodo(),
    loader: ({ params }) => this.api.invoke(dashboardProduccionPorOperador, params, SIN_AVISOS()),
  });
  protected readonly tablaProduccion = computed(() =>
    tablaProduccion(
      this.produccion.value() ?? [],
      new Map(this.etapas().map((e) => [e.id ?? 0, e.ordenLogico ?? 0])),
    ),
  );
  protected readonly totalPiezasProduccion = computed(() =>
    this.tablaProduccion().filas.reduce((total, f) => total + f.totalPiezas, 0),
  );

  protected readonly ubicaciones = resource({
    params: () => ({ ...this.periodo(), nivel: this.nivelActual() }),
    loader: ({ params }) => this.api.invoke(dashboardPedidosPorUbicacion, params, SIN_AVISOS()),
  });
  protected readonly maximoPedidosUbicacion = computed(() =>
    Math.max(0, ...(this.ubicaciones.value() ?? []).map((u) => u.pedidos ?? 0)),
  );
  protected readonly ubicacionesIniciales = UBICACIONES_INICIALES;
  protected readonly verTodasUbicaciones = signal(false);

  // ---- Acciones

  protected actualizar(): void {
    for (const r of [
      this.pedidosPorEstado,
      this.atrasados,
      this.lineasPorEstado,
      this.entrega,
      this.ciclo,
      this.produccion,
      this.ubicaciones,
    ]) {
      r.reload();
    }
  }

  protected elegirAtajo(atajo: Atajo): void {
    this.navegar({ ...periodoDeAtajo(atajo, this.hoy) });
  }

  protected cambiarFecha(campo: keyof Periodo, valor: string): void {
    this.fechas.update((f) => ({ ...f, [campo]: valor }));
    if (!this.errorFechas()) {
      this.navegar({ ...this.fechas() });
    }
  }

  protected navegar(queryParams: Record<string, unknown>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }

  /** "1 línea", "1.250 líneas". */
  protected cantidad(n: number | undefined, uno: string, varios: string): string {
    return `${formatNumber(n ?? 0, this.locale)} ${n === 1 ? uno : varios}`;
  }

  protected enlaceEstado(estadoId: number | undefined, esFinal: boolean | undefined) {
    return { estados: estadoId, abiertos: esFinal ? '0' : null };
  }
}
