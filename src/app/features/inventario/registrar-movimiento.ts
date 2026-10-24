import { DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, resource, signal } from '@angular/core';
import {
  debounce,
  form,
  FormField,
  maxLength,
  min,
  readonly,
  required,
  submit,
} from '@angular/forms/signals';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { inventarioRegistrar } from '../../api/fn/inventario/inventario-registrar';
import { listaMaterialesBuscarItems } from '../../api/fn/lista-de-materiales/lista-materiales-buscar-items';
import { MovimientoDto } from '../../api/models/movimiento-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { NOMBRE_TIPO_MOVIMIENTO, TipoMovimientoManual } from './inventario';
import { SelectorSlot } from './selector-slot';

/** Valores iniciales, ej. desde una fila de existencias: el ítem y su slot ya elegidos. */
export interface DatosMovimiento {
  tipo?: TipoMovimientoManual;
  itemCodigo?: string;
  slotId?: number;
  /** Saldo actual en el slot, para mostrarlo como referencia. */
  saldo?: number;
  unidad?: string;
}

interface Modelo {
  itemCodigo: string;
  cantidad: number | null;
  motivo: string;
  observaciones: string;
}

const TIPOS: readonly TipoMovimientoManual[] = ['ENTRADA', 'SALIDA', 'TRASLADO', 'AJUSTE'];

/** Registra una entrada, salida, traslado o ajuste por conteo. Devuelve el movimiento registrado. */
@Component({
  selector: 'pi-registrar-movimiento',
  imports: [
    DecimalPipe,
    FormField,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    SelectorSlot,
  ],
  templateUrl: './registrar-movimiento.html',
  styleUrl: './registrar-movimiento.scss',
})
export class RegistrarMovimiento {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<RegistrarMovimiento, MovimientoDto>);
  protected readonly inicial = inject<DatosMovimiento | null>(MAT_DIALOG_DATA) ?? {};

  protected readonly tipos = TIPOS;
  protected readonly nombreTipo = NOMBRE_TIPO_MOVIMIENTO;
  protected readonly tipo = signal<TipoMovimientoManual>(this.inicial.tipo ?? 'ENTRADA');
  protected readonly origen = signal<number | null>(
    this.inicial.tipo === 'SALIDA' || this.inicial.tipo === 'TRASLADO'
      ? (this.inicial.slotId ?? null)
      : null,
  );
  protected readonly destino = signal<number | null>(
    this.inicial.tipo === 'SALIDA' || this.inicial.tipo === 'TRASLADO'
      ? null
      : (this.inicial.slotId ?? null),
  );
  protected readonly usaOrigen = computed(() => ['SALIDA', 'TRASLADO'].includes(this.tipo()));
  protected readonly usaDestino = computed(() => this.tipo() !== 'SALIDA');

  protected readonly datos = signal<Modelo>({
    itemCodigo: this.inicial.itemCodigo ?? '',
    cantidad: null,
    motivo: '',
    observaciones: '',
  });
  // Mismas reglas que el backend (MovimientoRequestDTO)
  protected readonly formulario = form(this.datos, (d) => {
    required(d.itemCodigo, { message: 'Elija el ítem.' });
    readonly(d.itemCodigo, () => !!this.inicial.itemCodigo);
    // Las sugerencias se piden cuando se deja de escribir
    debounce(d.itemCodigo, 300);
    required(d.cantidad, { message: 'Ingrese la cantidad.' });
    min(d.cantidad, 0, { message: 'No puede ser negativa.' });
    maxLength(d.motivo, 100, { message: 'Máximo 100 caracteres.' });
    maxLength(d.observaciones, 500, { message: 'Máximo 500 caracteres.' });
  });
  protected readonly error = signal<string | null>(null);

  /** Sugerencias del ítem mientras se escribe (desde 2 caracteres). */
  protected readonly sugerencias = resource({
    params: () => {
      const texto = this.datos().itemCodigo.trim();
      return texto.length >= 2 && !this.inicial.itemCodigo ? { texto, tamano: 10 } : undefined;
    },
    loader: ({ params }) =>
      this.api.invoke(
        listaMaterialesBuscarItems,
        params,
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });

  protected elegirTipo(tipo: TipoMovimientoManual): void {
    // El slot elegido pasa al rol que tenga en el nuevo tipo (ej. de salida a traslado sigue siendo el origen)
    const slot = this.origen() ?? this.destino();
    this.tipo.set(tipo);
    this.origen.set(this.usaOrigen() ? slot : null);
    this.destino.set(this.usaOrigen() ? null : slot);
    this.error.set(null);
  }

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    const tipo = this.tipo();
    if ((this.usaOrigen() && !this.origen()) || (this.usaDestino() && !this.destino())) {
      this.error.set(
        tipo === 'TRASLADO'
          ? 'Elija el slot de origen y el de destino.'
          : 'Elija la bodega y el slot.',
      );
      return;
    }
    await submit(this.formulario, async () => {
      const d = this.datos();
      try {
        const movimiento = await this.api.invoke(
          inventarioRegistrar,
          {
            body: {
              tipo,
              itemCodigo: d.itemCodigo.trim(),
              cantidad: d.cantidad ?? 0,
              slotOrigenId: this.usaOrigen() ? (this.origen() ?? undefined) : undefined,
              slotDestinoId: this.usaDestino() ? (this.destino() ?? undefined) : undefined,
              motivo: d.motivo.trim() || undefined,
              observaciones: d.observaciones.trim() || undefined,
            },
          },
          new HttpContext().set(MANEJA_ERRORES, true),
        );
        this.dialogo.close(movimiento);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
