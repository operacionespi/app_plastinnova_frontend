import { HttpContext } from '@angular/common/http';
import { Component, inject, resource, signal } from '@angular/core';
import {
  debounce,
  form,
  FormField,
  max,
  min,
  readonly,
  required,
  submit,
} from '@angular/forms/signals';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { listaMaterialesBuscarItems } from '../../api/fn/lista-de-materiales/lista-materiales-buscar-items';
import { ordenProduccionAgregarProducto } from '../../api/fn/ordenes-de-produccion/orden-produccion-agregar-producto';
import { ordenProduccionCambiarCantidad } from '../../api/fn/ordenes-de-produccion/orden-produccion-cambiar-cantidad';
import { OrdenProduccionDto } from '../../api/models/orden-produccion-dto';
import { ProductoOrdenDto } from '../../api/models/producto-orden-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';

export interface DatosProducto {
  orden: OrdenProduccionDto;
  /** Si viene, se cambia su cantidad; si no, se agrega un producto. */
  producto?: ProductoOrdenDto;
}

interface Modelo {
  itemCodigo: string;
  cantidad: number | null;
}

/**
 * Agrega un producto a la orden (sus piezas empiezan en el primer proceso de su ruta) o cambia la cantidad de uno: la
 * diferencia entra o sale del primer proceso. Devuelve la orden actualizada.
 */
@Component({
  selector: 'pi-formulario-producto',
  imports: [
    FormField,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{
        producto ? 'Cantidad de ' + producto.itemCodigo : 'Agregar producto a ' + datos.orden.numero
      }}
    </h2>
    <form (submit)="guardar($event)" novalidate>
      <mat-dialog-content>
        @if (error(); as mensaje) {
          <p class="mensaje-error" role="alert">{{ mensaje }}</p>
        }
        @if (!producto) {
          <mat-form-field appearance="outline">
            <mat-label>Ítem a producir</mat-label>
            <input
              matInput
              autocomplete="off"
              [formField]="formulario.itemCodigo"
              [matAutocomplete]="items"
            />
            <mat-autocomplete #items="matAutocomplete">
              @for (i of sugerencias.value()?.content ?? []; track i.codigo) {
                <mat-option [value]="i.codigo">
                  <span class="codigo">{{ i.codigo }}</span> {{ i.descripcion }}
                </mat-option>
              }
            </mat-autocomplete>
            <mat-hint>Escriba parte del código o la descripción</mat-hint>
            @for (e of formulario.itemCodigo().errors(); track e.kind) {
              <mat-error>{{ e.message }}</mat-error>
            }
          </mat-form-field>
        }
        <mat-form-field appearance="outline">
          <mat-label>Piezas a producir</mat-label>
          <input matInput type="number" inputmode="numeric" [formField]="formulario.cantidad" />
          @if (producto) {
            <mat-hint>
              Las piezas que agregue o quite entran o salen de {{ primerProceso }} ({{
                enPrimerProceso
              }}
              ahora).
            </mat-hint>
          }
          @for (e of formulario.cantidad().errors(); track e.kind) {
            <mat-error>{{ e.message }}</mat-error>
          }
        </mat-form-field>
        @if (!producto) {
          <p class="ayuda">
            Sus piezas empiezan en el primer proceso de la ruta del ítem. Para que atienda pedidos,
            asígnele líneas después.
          </p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit" [disabled]="formulario().submitting()">
          {{ producto ? 'Guardar' : 'Agregar' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: '../pedidos/dialogo-pedido.scss',
  styles: `
    .codigo {
      font-weight: 500;
    }
  `,
})
export class FormularioProducto {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<FormularioProducto, OrdenProduccionDto>);
  protected readonly datos = inject<DatosProducto>(MAT_DIALOG_DATA);
  protected readonly producto = this.datos.producto;
  protected readonly primerProceso = this.producto?.etapas?.[0]?.etapa?.nombre ?? '';
  protected readonly enPrimerProceso = this.producto?.etapas?.[0]?.cantidad ?? 0;
  /** No se pueden quitar más piezas de las que hay en el primer proceso. */
  private readonly minimo = this.producto
    ? Math.max((this.producto.cantidad ?? 0) - this.enPrimerProceso, 1)
    : 1;

  protected readonly modelo = signal<Modelo>({
    itemCodigo: this.producto?.itemCodigo ?? '',
    cantidad: this.producto?.cantidad ?? null,
  });
  protected readonly formulario = form(this.modelo, (d) => {
    required(d.itemCodigo, { message: 'Elija el ítem.' });
    readonly(d.itemCodigo, () => !!this.producto);
    debounce(d.itemCodigo, 300);
    required(d.cantidad, { message: 'Ingrese la cantidad.' });
    min(d.cantidad, this.minimo, {
      message:
        this.minimo > 1
          ? `Mínimo ${this.minimo}: ya hay piezas más allá de ${this.primerProceso}.`
          : 'Debe ser mayor que cero.',
    });
    max(d.cantidad, 1_000_000, { message: 'No puede pasar de 1.000.000.' });
  });
  protected readonly error = signal<string | null>(null);

  protected readonly sugerencias = resource({
    params: () => {
      const texto = this.modelo().itemCodigo.trim();
      return texto.length >= 2 && !this.producto ? { texto, tamano: 10 } : undefined;
    },
    loader: ({ params }) =>
      this.api.invoke(
        listaMaterialesBuscarItems,
        params,
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const m = this.modelo();
      const id = this.datos.orden.id ?? 0;
      const contexto = new HttpContext().set(MANEJA_ERRORES, true);
      try {
        this.dialogo.close(
          this.producto
            ? await this.api.invoke(
                ordenProduccionCambiarCantidad,
                { id, productoId: this.producto.id ?? 0, body: { cantidad: m.cantidad ?? 0 } },
                contexto,
              )
            : await this.api.invoke(
                ordenProduccionAgregarProducto,
                { id, body: { itemCodigo: m.itemCodigo.trim(), cantidad: m.cantidad ?? 0 } },
                contexto,
              ),
        );
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
