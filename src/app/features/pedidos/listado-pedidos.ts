import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, effect, inject, input, linkedSignal, resource } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { KpiPedidosPorEstadoDto } from '../../api/models/kpi-pedidos-por-estado-dto';
import { estadosPedidoListar } from '../../api/fn/catalogo-estados-de-pedido/estados-pedido-listar';
import { dashboardVendedores } from '../../api/fn/tablero-e-indicadores/dashboard-vendedores';
import { dashboardBuscarPedidos } from '../../api/fn/tablero-e-indicadores/dashboard-buscar-pedidos';
import { dashboardContarPedidosPorEstado } from '../../api/fn/tablero-e-indicadores/dashboard-contar-pedidos-por-estado';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { EstadoChip } from '../../core/ui/estado-chip';
import { DiaPipe, UtcPipe } from '../../core/ui/fechas';
import {
  aFiltroApi,
  aParametros,
  CampoOrdenPedidos,
  FiltrosPedidos,
  leerFiltros,
  leerOrden,
  leerPagina,
} from './filtros-pedidos';
import { TarjetasEstado } from './tarjetas-estado';
import { UltimoListado } from './ultimo-listado';

export const PEDIDOS_POR_PAGINA = 25;

/** Coordinación: pedidos con filtros, orden y paginación en el servidor. */
@Component({
  selector: 'pi-listado-pedidos',
  imports: [
    DatePipe,
    DecimalPipe,
    DiaPipe,
    EstadoChip,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSortModule,
    MatTableModule,
    RouterLink,
    TarjetasEstado,
    UtcPipe,
  ],
  templateUrl: './listado-pedidos.html',
  styleUrl: './listado-pedidos.scss',
})
export class ListadoPedidos {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly ultimoListado = inject(UltimoListado);

  // Parámetros de la URL
  readonly numero = input<string>();
  readonly ciudad = input<string>();
  readonly vendedor = input<string | string[]>();
  readonly estados = input<string>();
  readonly desde = input<string>();
  readonly hasta = input<string>();
  readonly abiertos = input<string>();
  readonly atrasados = input<string>();
  readonly pagina = input<string>();
  readonly orden = input<string>();

  protected readonly filtros = computed(() =>
    leerFiltros({
      numero: this.numero(),
      ciudad: this.ciudad(),
      vendedor: this.vendedor(),
      estados: this.estados(),
      desde: this.desde(),
      hasta: this.hasta(),
      abiertos: this.abiertos(),
      atrasados: this.atrasados(),
    }),
  );
  protected readonly ordenActual = computed(() => leerOrden(this.orden()));
  protected readonly paginaActual = computed(() => leerPagina(this.pagina()));

  /** Lo que el usuario está editando; se reinicia con lo que diga la URL. */
  protected readonly datos = linkedSignal<FiltrosPedidos>(() => this.filtros());
  protected readonly formulario = form(this.datos);

  protected readonly catalogo = resource({
    loader: () => this.api.invoke(estadosPedidoListar, { incluirInactivos: true }),
  });

  protected readonly vendedores = resource({
    loader: () => this.api.invoke(dashboardVendedores),
  });
  /** Los vendedores de la URL que ya no están en la lista se siguen mostrando como seleccionados. */
  protected readonly opcionesVendedor = computed(() => {
    const lista = this.vendedores.value() ?? [];
    return [...this.filtros().vendedores.filter((v) => !lista.includes(v)), ...lista];
  });

  protected readonly pedidos = resource({
    params: () => ({
      filtro: aFiltroApi(this.filtros()),
      pagina: this.paginaActual(),
      orden: this.ordenActual(),
    }),
    loader: ({ params }) =>
      this.api.invoke(
        dashboardBuscarPedidos,
        {
          pageable: {
            page: params.pagina,
            size: PEDIDOS_POR_PAGINA,
            sort: params.orden ? [`${params.orden.campo},${params.orden.direccion}`] : undefined,
          },
          body: params.filtro,
        },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  /** Los demás filtros, comparados por contenido: cambiar de estado no vuelve a consultar el conteo. */
  private readonly filtroConteo = computed(
    () => aFiltroApi({ ...this.filtros(), estadosIds: [] }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly conteos = resource({
    params: () => this.filtroConteo(),
    loader: ({ params }) =>
      this.api.invoke(
        dashboardContarPedidosPorEstado,
        { body: params },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  /** Mientras llega el conteo nuevo se mantiene el anterior para que las tarjetas no parpadeen. */
  protected readonly ultimoConteo = linkedSignal<
    KpiPedidosPorEstadoDto[] | undefined,
    KpiPedidosPorEstadoDto[] | undefined
  >({
    source: () => (this.conteos.error() ? [] : this.conteos.value()),
    computation: (conteo, anterior) => conteo ?? anterior?.value,
  });

  protected readonly error = computed(() =>
    this.pedidos.error() ? leerProblema(this.pedidos.error()).mensaje : null,
  );
  protected readonly total = computed(() => this.pedidos.value()?.page?.totalElements ?? 0);
  protected readonly hayFiltros = computed(() => {
    const f = this.filtros();
    return !!(
      f.numero ||
      f.ciudad ||
      f.vendedores.length ||
      f.estadosIds.length ||
      f.desde ||
      f.hasta ||
      !f.soloAbiertos ||
      f.soloAtrasados
    );
  });

  protected readonly columnas = [
    'numeroPedido',
    'cliente',
    'ubicacion',
    'estado',
    'fechaCreacionFm',
    'fechaEstimadaEntrega',
    'avance',
  ];

  constructor() {
    // El detalle vuelve a este listado con los mismos filtros
    effect(() => {
      this.filtros();
      this.paginaActual();
      this.ordenActual();
      this.ultimoListado.url.set(this.router.url);
    });
  }

  protected aplicar(evento?: Event): void {
    evento?.preventDefault();
    this.navegar(aParametros(this.datos(), this.ordenActual()));
  }

  protected limpiar(): void {
    this.navegar(aParametros(leerFiltros({}), this.ordenActual()));
  }

  protected alternarEstado(estadoId: number): void {
    const actuales = this.filtros().estadosIds;
    const estados = actuales.includes(estadoId)
      ? actuales.filter((id) => id !== estadoId)
      : [...actuales, estadoId];
    this.navegar({ estados: estados.length ? estados.join(',') : null, pagina: null });
  }

  protected quitarEstados(): void {
    this.navegar({ estados: null, pagina: null });
  }

  protected ordenar(orden: Sort): void {
    const campo = orden.active as CampoOrdenPedidos;
    this.navegar({
      orden: orden.direction ? `${campo},${orden.direction}` : null,
      pagina: null,
    });
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.navegar({ pagina: evento.pageIndex || null });
  }

  protected porcentaje(procesadas = 0, solicitadas = 0): number {
    return solicitadas > 0 ? Math.min(100, (procesadas / solicitadas) * 100) : 0;
  }

  private navegar(queryParams: Record<string, unknown>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }
}
