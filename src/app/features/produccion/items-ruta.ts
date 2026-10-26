import { HttpContext } from '@angular/common/http';
import { Component, inject, resource, signal } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Api } from '../../api/api';
import { listaMaterialesBuscarItems } from '../../api/fn/lista-de-materiales/lista-materiales-buscar-items';
import { rutaProduccionAsignar } from '../../api/fn/rutas-de-produccion/ruta-produccion-asignar';
import { rutaProduccionItems } from '../../api/fn/rutas-de-produccion/ruta-produccion-items';
import { rutaProduccionQuitar } from '../../api/fn/rutas-de-produccion/ruta-produccion-quitar';
import { ItemRutaDto } from '../../api/models/item-ruta-dto';
import { RutaProduccionDto } from '../../api/models/ruta-produccion-dto';
import { Sesion } from '../../core/auth/sesion';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { PERMISOS } from '../../core/navegacion/navegacion';

/**
 * Ítems que siguen la ruta. Se agregan por código (uno o varios separados por coma, espacio o salto de línea); un ítem
 * que tenía otra ruta pasa a esta. Al cerrar devuelve true si hubo cambios.
 */
@Component({
  selector: 'pi-items-ruta',
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  template: `
    <h2 mat-dialog-title>Ítems de {{ ruta.nombre }}</h2>
    <mat-dialog-content>
      @if (error(); as mensaje) {
        <p class="mensaje-error" role="alert">{{ mensaje }}</p>
      }
      @if (puedeGestionar && ruta.activa) {
        <form class="agregar" (submit)="agregar($event)" novalidate>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="crece">
            <mat-label>Códigos de ítem</mat-label>
            <input
              matInput
              autocomplete="off"
              [value]="texto()"
              (input)="texto.set($any($event.target).value)"
              [matAutocomplete]="sugeridos"
            />
            <mat-autocomplete
              #sugeridos="matAutocomplete"
              (optionSelected)="texto.set($event.option.value)"
            >
              @for (i of sugerencias.value()?.content ?? []; track i.codigo) {
                <mat-option [value]="i.codigo">
                  <span class="codigo">{{ i.codigo }}</span> {{ i.descripcion }}
                </mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
          <button matButton="tonal" type="submit" [disabled]="!texto().trim() || ocupado()">
            <mat-icon>add</mat-icon>
            Agregar
          </button>
        </form>
      }
      @if (items.hasValue()) {
        <ul class="items">
          @for (i of items.value(); track i.codigo) {
            <li>
              <span class="crece">
                <span class="codigo">{{ i.codigo }}</span>
                <span class="secundario"> {{ i.descripcion }}</span>
              </span>
              @if (puedeGestionar) {
                <button
                  matIconButton
                  type="button"
                  [disabled]="ocupado()"
                  [attr.aria-label]="'Quitar ' + i.codigo + ' de la ruta'"
                  (click)="quitar(i)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              }
            </li>
          } @empty {
            <li class="secundario">Ningún ítem sigue esta ruta.</li>
          }
        </ul>
      } @else {
        <mat-progress-bar mode="indeterminate" aria-label="Cargando ítems" />
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="filled" type="button" (click)="cerrar()">Listo</button>
    </mat-dialog-actions>
  `,
  styleUrl: '../pedidos/dialogo-pedido.scss',
  styles: `
    .agregar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;

      button {
        min-height: 48px;
      }
    }
    .crece {
      flex: 1 1 200px;
      min-width: 0;
    }
    .items {
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 48px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
    .codigo {
      font-weight: 500;
    }
    .secundario {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ItemsRuta {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<ItemsRuta, boolean>);
  protected readonly ruta = inject<RutaProduccionDto>(MAT_DIALOG_DATA);
  protected readonly puedeGestionar = inject(Sesion).tienePermiso(PERMISOS.gestionarProduccion);

  protected readonly texto = signal('');
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  private cambio = false;

  protected readonly items = resource({
    loader: () =>
      this.api.invoke(
        rutaProduccionItems,
        { id: this.ruta.id ?? 0 },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly sugerencias = resource({
    params: () => {
      const texto = this.texto().trim();
      return texto.length >= 2 && !/[\s,]/.test(texto) ? { texto, tamano: 10 } : undefined;
    },
    loader: ({ params }) =>
      this.api.invoke(
        listaMaterialesBuscarItems,
        params,
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });

  protected agregar(evento: Event): Promise<void> {
    evento.preventDefault();
    const codigos = this.texto()
      .split(/[\s,;]+/)
      .map((c) => c.trim())
      .filter((c) => c);
    return this.ejecutar(async () => {
      const items = await this.api.invoke(
        rutaProduccionAsignar,
        { id: this.ruta.id ?? 0, body: { codigos } },
        new HttpContext().set(MANEJA_ERRORES, true),
      );
      this.texto.set('');
      return items;
    });
  }

  protected quitar(item: ItemRutaDto): Promise<void> {
    return this.ejecutar(() =>
      this.api.invoke(
        rutaProduccionQuitar,
        { id: this.ruta.id ?? 0, codigo: item.codigo ?? '' },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
    );
  }

  protected cerrar(): void {
    this.dialogo.close(this.cambio);
  }

  private async ejecutar(accion: () => Promise<ItemRutaDto[]>): Promise<void> {
    this.error.set(null);
    this.ocupado.set(true);
    try {
      this.items.set(await accion());
      this.cambio = true;
    } catch (e) {
      this.error.set(leerProblema(e).mensaje);
    } finally {
      this.ocupado.set(false);
    }
  }
}
