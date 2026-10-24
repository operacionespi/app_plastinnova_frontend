import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { form, FormField, min } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { Api } from '../../api/api';
import { listaMaterialesBuscarItems } from '../../api/fn/lista-de-materiales/lista-materiales-buscar-items';
import { listaMaterialesEstructura } from '../../api/fn/lista-de-materiales/lista-materiales-estructura';
import { listaMaterialesUltimasCargas } from '../../api/fn/lista-de-materiales/lista-materiales-ultimas-cargas';
import { CargaListaMaterialesDto } from '../../api/models/carga-lista-materiales-dto';
import { ItemResumenDto } from '../../api/models/item-resumen-dto';
import { Sesion } from '../../core/auth/sesion';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { Avisos } from '../../core/ui/avisos';
import { UtcPipe } from '../../core/ui/fechas';
import { ArbolMateriales, nombreTipo } from './arbol-materiales';
import { CargarListaMateriales } from './cargar-lista-materiales';

const ITEMS_POR_PAGINA = 20;

/**
 * Consulta de la lista de materiales: buscar un ítem y ver su estructura completa para una cantidad. Quien tiene
 * material:cargar recarga aquí los CSV del ERP. La búsqueda y el ítem elegido van en la URL (?texto=&codigo=).
 */
@Component({
  selector: 'pi-lista-materiales',
  imports: [
    ArbolMateriales,
    DatePipe,
    DecimalPipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    UtcPipe,
  ],
  templateUrl: './lista-materiales.html',
  styleUrl: './lista-materiales.scss',
})
export class ListaMateriales {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);

  /** Parámetros de la URL. */
  readonly texto = input<string>();
  readonly codigo = input<string>();

  protected readonly puedeCargar = inject(Sesion).tienePermiso(PERMISOS.cargarMateriales);
  protected readonly nombreTipo = nombreTipo;

  protected readonly cargas = resource({
    loader: () =>
      this.api.invoke(
        listaMaterialesUltimasCargas,
        {},
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly ultimaCarga = computed(() => this.cargas.value()?.[0]);

  // Búsqueda
  protected readonly datos = signal({ texto: '' });
  protected readonly formulario = form(this.datos);
  protected readonly buscado = computed(() => this.texto()?.trim() ?? '');
  protected readonly pagina = signal(0);
  protected readonly items = resource({
    params: () =>
      this.buscado()
        ? { texto: this.buscado(), pagina: this.pagina(), tamano: ITEMS_POR_PAGINA }
        : undefined,
    loader: ({ params }) =>
      this.api.invoke(
        listaMaterialesBuscarItems,
        params,
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly errorItems = computed(() =>
    this.items.error() ? leerProblema(this.items.error()).mensaje : null,
  );

  // Estructura del ítem elegido
  protected readonly cantidad = signal({ cantidad: 1 });
  protected readonly formularioCantidad = form(this.cantidad, (c) => {
    min(c.cantidad, 0.000001, { message: 'Debe ser mayor que cero' });
  });
  /** Mientras el campo está vacío o en cero se conserva el árbol de la última cantidad válida. */
  private readonly cantidadValida = linkedSignal<number, number>({
    source: () => this.cantidad().cantidad,
    computation: (cantidad, anterior) => (cantidad > 0 ? cantidad : (anterior?.value ?? 1)),
  });
  protected readonly estructura = resource({
    params: () => {
      const codigo = this.codigo();
      return codigo ? { codigo, cantidad: this.cantidadValida() } : undefined;
    },
    loader: ({ params }) =>
      this.api.invoke(
        listaMaterialesEstructura,
        params,
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly errorEstructura = computed(() =>
    this.estructura.error() ? leerProblema(this.estructura.error()) : null,
  );

  constructor() {
    // El campo muestra lo que está en la URL (ej. al volver atrás)
    effect(() => this.datos.set({ texto: this.buscado() }));
  }

  protected buscar(evento: Event): void {
    evento.preventDefault();
    this.pagina.set(0);
    const texto = this.datos().texto.trim();
    void this.router.navigate([], { queryParams: { texto: texto || null, codigo: null } });
  }

  protected elegir(item: ItemResumenDto): void {
    void this.router.navigate([], {
      queryParams: { codigo: item.codigo },
      queryParamsHandling: 'merge',
    });
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
  }

  protected cargar(): void {
    this.dialogos
      .open<CargarListaMateriales, void, CargaListaMaterialesDto>(CargarListaMateriales, {
        width: '640px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((carga) => {
        if (carga) {
          this.avisos.exito('Lista de materiales cargada.');
          this.cargas.reload();
          this.items.reload();
          this.estructura.reload();
        }
      });
  }
}
