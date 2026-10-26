import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { form, FormField, maxLength } from '@angular/forms/signals';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { listaMaterialesBuscarItems } from '../../api/fn/lista-de-materiales/lista-materiales-buscar-items';
import { ordenProduccionCrear } from '../../api/fn/ordenes-de-produccion/orden-produccion-crear';
import { ordenProduccionLineasPendientes } from '../../api/fn/ordenes-de-produccion/orden-produccion-lineas-pendientes';
import { LineaOrdenDto } from '../../api/models/linea-orden-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { Avisos } from '../../core/ui/avisos';
import { EstadoChip } from '../../core/ui/estado-chip';
import { DiaPipe } from '../../core/ui/fechas';

const POR_PAGINA = 25;

/** Línea elegida con las piezas que le tocan. */
interface Elegida {
  linea: LineaOrdenDto;
  cantidad: number;
}

/** Un producto de la orden: sus líneas y, si se quiere producir más para inventario, una cantidad mayor. */
interface Producto {
  itemCodigo: string;
  itemDescripcion: string | undefined;
  lineas: Elegida[];
  /** null: lo asignado a las líneas. */
  cantidad: number | null;
}

interface Datos {
  fechaRequerida: string;
  observaciones: string;
}

/**
 * Crea una orden de producción eligiendo líneas pendientes de uno o varios pedidos: se agrupan por ítem, cada grupo es
 * un producto de la orden. También admite productos sin pedido (para inventario).
 */
@Component({
  selector: 'pi-nueva-orden',
  imports: [
    DatePipe,
    DecimalPipe,
    DiaPipe,
    EstadoChip,
    FormField,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    RouterLink,
  ],
  template: `
    <a matButton class="volver" routerLink="/produccion">
      <mat-icon>arrow_back</mat-icon>
      Órdenes de producción
    </a>
    <h1>Nueva orden de producción</h1>
    <p class="ayuda">
      Elija líneas de uno o varios pedidos: se agrupan por producto. Cada producto recorre los
      procesos de su ruta y las líneas siguen a sus piezas hasta Almacén 1.
    </p>

    <div class="columnas">
      <section class="pendientes" aria-labelledby="titulo-pendientes">
        <h2 id="titulo-pendientes">Líneas pendientes</h2>
        <form class="filtros" role="search" (submit)="buscar($event)" novalidate>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="texto">
            <mat-label>Pedido, cliente o producto</mat-label>
            <input
              matInput
              type="search"
              autocomplete="off"
              [value]="textoBusqueda()"
              (input)="textoBusqueda.set($any($event.target).value)"
            />
          </mat-form-field>
          <button matButton="filled" type="submit">
            <mat-icon>search</mat-icon>
            Buscar
          </button>
        </form>
        @if (pendientes.error()) {
          <div class="mensaje-error" role="alert">
            <span>{{ errorPendientes() }}</span>
            <button matButton type="button" (click)="pendientes.reload()">Reintentar</button>
          </div>
        } @else if (pendientes.hasValue()) {
          @let pagina = pendientes.value();
          <ul class="lineas">
            @for (l of pagina.content ?? []; track l.detalleId) {
              <li [class.bloqueada]="!!l.motivo" [class.elegida]="elegida(l)">
                <mat-checkbox
                  [checked]="elegida(l)"
                  [disabled]="!!l.motivo"
                  (change)="alternar(l)"
                  [attr.aria-label]="'Pedido ' + l.numeroPedido + ' línea ' + l.posicion"
                />
                <div class="datos">
                  <span>
                    <span class="codigo">{{ l.numeroPedido }} · línea {{ l.posicion }}</span>
                    <span class="secundario"> · {{ l.cliente }}</span>
                  </span>
                  <span>
                    <span class="codigo">{{ l.itemCodigo }}</span>
                    <span class="secundario"> {{ l.itemDescripcion }}</span>
                  </span>
                  <span class="secundario">
                    Faltan {{ l.cantidad | number }} de {{ l.cantidadSolicitada | number }}
                    @if (l.fechaEstimadaEntrega) {
                      · entrega {{ l.fechaEstimadaEntrega | dia | date: 'd MMM y' }}
                    }
                  </span>
                  @if (l.motivo) {
                    <span class="motivo">{{ l.motivo }}</span>
                  }
                </div>
                <pi-estado-chip [estado]="l.estadoLinea" />
              </li>
            } @empty {
              <li class="vacio">No hay líneas pendientes sin orden con esa búsqueda.</li>
            }
          </ul>
          @if ((pagina.page?.totalElements ?? 0) > (pagina.page?.size ?? 0)) {
            <mat-paginator
              [length]="pagina.page?.totalElements ?? 0"
              [pageIndex]="pagina.page?.number ?? 0"
              [pageSize]="pagina.page?.size ?? 25"
              [hidePageSize]="true"
              aria-label="Páginas de líneas pendientes"
              (page)="numeroPagina.set($event.pageIndex)"
            />
          }
        } @else {
          <mat-progress-bar mode="indeterminate" aria-label="Buscando líneas" />
        }
      </section>

      <section class="orden" aria-labelledby="titulo-orden">
        <h2 id="titulo-orden">La orden</h2>
        @if (error(); as mensaje) {
          <p class="mensaje-error" role="alert">{{ mensaje }}</p>
        }
        @for (p of productos(); track p.itemCodigo) {
          <article class="producto">
            <header>
              <div>
                <span class="codigo">{{ p.itemCodigo }}</span>
                <span class="secundario"> {{ p.itemDescripcion }}</span>
              </div>
              <button
                matIconButton
                type="button"
                [attr.aria-label]="'Quitar ' + p.itemCodigo"
                matTooltip="Quitar el producto"
                (click)="quitarProducto(p)"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </header>
            @for (e of p.lineas; track e.linea.detalleId) {
              <div class="asignacion">
                <span class="crece">
                  {{ e.linea.numeroPedido }} · línea {{ e.linea.posicion }}
                  <span class="secundario">({{ e.linea.cliente }})</span>
                </span>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="piezas">
                  <mat-label>Piezas</mat-label>
                  <input
                    matInput
                    type="number"
                    inputmode="numeric"
                    min="1"
                    [max]="e.linea.cantidad ?? 0"
                    [value]="e.cantidad"
                    (change)="cambiarPiezas(p, e, $any($event.target).valueAsNumber)"
                  />
                </mat-form-field>
                <button
                  matIconButton
                  type="button"
                  [attr.aria-label]="
                    'Quitar la línea ' + e.linea.posicion + ' del pedido ' + e.linea.numeroPedido
                  "
                  (click)="alternar(e.linea)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }
            <div class="asignacion total">
              <span class="crece">
                @if (p.lineas.length) {
                  {{ asignado(p) | number }} para pedidos; lo demás queda libre en inventario.
                } @else {
                  Para inventario.
                }
              </span>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="piezas">
                <mat-label>A producir</mat-label>
                <input
                  matInput
                  type="number"
                  inputmode="numeric"
                  [min]="asignado(p) || 1"
                  [value]="p.cantidad ?? asignado(p)"
                  (change)="cambiarCantidad(p, $any($event.target).valueAsNumber)"
                />
              </mat-form-field>
            </div>
          </article>
        } @empty {
          <p class="vacio">Elija líneas pendientes o agregue un producto para inventario.</p>
        }

        <form class="agregar" (submit)="agregarProducto($event)" novalidate>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="crece">
            <mat-label>Producto para inventario</mat-label>
            <input
              matInput
              autocomplete="off"
              [value]="textoItem()"
              (input)="textoItem.set($any($event.target).value)"
              [matAutocomplete]="items"
            />
            <mat-autocomplete
              #items="matAutocomplete"
              (optionSelected)="textoItem.set($event.option.value)"
            >
              @for (i of sugerencias.value()?.content ?? []; track i.codigo) {
                <mat-option [value]="i.codigo">
                  <span class="codigo">{{ i.codigo }}</span> {{ i.descripcion }}
                </mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
          <button matButton="tonal" type="submit" [disabled]="!textoItem().trim()">
            <mat-icon>add</mat-icon>
            Agregar
          </button>
        </form>

        <div class="fila">
          <mat-form-field appearance="outline" class="crece">
            <mat-label>Fecha requerida</mat-label>
            <input matInput type="date" [formField]="formulario.fechaRequerida" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Observaciones</mat-label>
          <textarea matInput rows="2" [formField]="formulario.observaciones"></textarea>
          @for (e of formulario.observaciones().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
        <button
          matButton="filled"
          type="button"
          class="crear"
          [disabled]="!productos().length || guardando()"
          (click)="crear()"
        >
          <mat-icon>precision_manufacturing</mat-icon>
          Crear orden · {{ totalPiezas() | number }} piezas
        </button>
      </section>
    </div>
  `,
  styleUrl: './nueva-orden.scss',
})
export class NuevaOrden {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);

  /** Parámetro de la URL: búsqueda inicial (ej. el número de pedido desde su detalle). */
  readonly texto = input<string>();

  protected readonly textoBusqueda = linkedSignal(() => this.texto() ?? '');
  private readonly filtro = linkedSignal(() => (this.texto() ?? '').trim());
  protected readonly numeroPagina = signal(0);
  protected readonly productos = signal<Producto[]>([]);
  protected readonly textoItem = signal('');
  protected readonly datos = signal<Datos>({ fechaRequerida: '', observaciones: '' });
  protected readonly formulario = form(this.datos, (d) => {
    maxLength(d.observaciones, 500, { message: 'Máximo 500 caracteres.' });
  });
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly pendientes = resource({
    params: () => ({ texto: this.filtro(), pagina: this.numeroPagina(), tamano: POR_PAGINA }),
    loader: ({ params }) =>
      this.api.invoke(
        ordenProduccionLineasPendientes,
        params,
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly errorPendientes = computed(() =>
    this.pendientes.error() ? leerProblema(this.pendientes.error()).mensaje : null,
  );
  protected readonly sugerencias = resource({
    params: () => {
      const texto = this.textoItem().trim();
      return texto.length >= 2 ? { texto, tamano: 10 } : undefined;
    },
    loader: ({ params }) =>
      this.api.invoke(
        listaMaterialesBuscarItems,
        params,
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  private readonly elegidas = computed(
    () => new Set(this.productos().flatMap((p) => p.lineas.map((e) => e.linea.detalleId))),
  );
  protected readonly totalPiezas = computed(() =>
    this.productos().reduce((total, p) => total + (p.cantidad ?? this.asignado(p)), 0),
  );

  protected buscar(evento: Event): void {
    evento.preventDefault();
    this.numeroPagina.set(0);
    this.filtro.set(this.textoBusqueda().trim());
  }

  protected elegida(l: LineaOrdenDto): boolean {
    return this.elegidas().has(l.detalleId);
  }

  protected asignado(p: Producto): number {
    return p.lineas.reduce((total, e) => total + e.cantidad, 0);
  }

  /** Elige o suelta la línea; al elegirla le toca todo lo que le falta. */
  protected alternar(l: LineaOrdenDto): void {
    const codigo = l.itemCodigo ?? '';
    this.productos.update((productos) => {
      if (this.elegida(l)) {
        return productos
          .map((p) => ({ ...p, lineas: p.lineas.filter((e) => e.linea.detalleId !== l.detalleId) }))
          .filter((p) => p.lineas.length || p.cantidad);
      }
      const elegida = { linea: l, cantidad: l.cantidad ?? 0 };
      const existente = productos.find((p) => p.itemCodigo === codigo);
      if (existente) {
        return productos.map((p) =>
          p === existente ? { ...p, lineas: [...p.lineas, elegida] } : p,
        );
      }
      return [
        ...productos,
        {
          itemCodigo: codigo,
          itemDescripcion: l.itemDescripcion,
          lineas: [elegida],
          cantidad: null,
        },
      ];
    });
    this.ajustarCantidades();
  }

  protected cambiarPiezas(producto: Producto, elegida: Elegida, piezas: number): void {
    const maximo = elegida.linea.cantidad ?? 0;
    const cantidad = Number.isInteger(piezas) ? Math.min(Math.max(piezas, 1), maximo) : maximo;
    this.productos.update((productos) =>
      productos.map((p) =>
        p === producto
          ? { ...p, lineas: p.lineas.map((e) => (e === elegida ? { ...e, cantidad } : e)) }
          : p,
      ),
    );
    this.ajustarCantidades();
  }

  /** Más de lo asignado queda para inventario; menos no se permite. */
  protected cambiarCantidad(producto: Producto, piezas: number): void {
    const minimo = Math.max(this.asignado(producto), 1);
    const cantidad = Number.isInteger(piezas) && piezas > minimo ? piezas : null;
    this.productos.update((productos) =>
      productos.map((p) =>
        p === producto ? { ...p, cantidad: cantidad ?? (p.lineas.length ? null : minimo) } : p,
      ),
    );
  }

  protected quitarProducto(producto: Producto): void {
    this.productos.update((productos) => productos.filter((p) => p !== producto));
  }

  protected agregarProducto(evento: Event): void {
    evento.preventDefault();
    const codigo = this.textoItem().trim();
    if (!codigo) {
      return;
    }
    const sugerido = this.sugerencias.value()?.content?.find((i) => i.codigo === codigo);
    if (this.productos().some((p) => p.itemCodigo.toUpperCase() === codigo.toUpperCase())) {
      this.error.set(`${codigo} ya está en la orden: cambie su cantidad a producir.`);
      return;
    }
    this.error.set(null);
    this.productos.update((productos) => [
      ...productos,
      { itemCodigo: codigo, itemDescripcion: sugerido?.descripcion, lineas: [], cantidad: 1 },
    ]);
    this.textoItem.set('');
  }

  protected async crear(): Promise<void> {
    this.error.set(null);
    this.guardando.set(true);
    const d = this.datos();
    try {
      const orden = await this.api.invoke(
        ordenProduccionCrear,
        {
          body: {
            fechaRequerida: d.fechaRequerida || undefined,
            observaciones: d.observaciones.trim() || undefined,
            productos: this.productos().map((p) => ({
              itemCodigo: p.itemCodigo,
              cantidad: p.cantidad ?? undefined,
              lineas: p.lineas.map((e) => ({
                detalleId: e.linea.detalleId ?? 0,
                cantidad: e.cantidad,
              })),
            })),
          },
        },
        new HttpContext().set(MANEJA_ERRORES, true),
      );
      this.avisos.exito(`${orden.numero} creada.`);
      void this.router.navigate(['/produccion', orden.id]);
    } catch (e) {
      this.error.set(leerProblema(e).mensaje);
    } finally {
      this.guardando.set(false);
    }
  }

  /** Una cantidad a producir menor que lo asignado vuelve a ser lo asignado. */
  private ajustarCantidades(): void {
    this.productos.update((productos) =>
      productos.map((p) =>
        p.cantidad !== null && p.lineas.length && p.cantidad <= this.asignado(p)
          ? { ...p, cantidad: null }
          : p,
      ),
    );
  }
}
