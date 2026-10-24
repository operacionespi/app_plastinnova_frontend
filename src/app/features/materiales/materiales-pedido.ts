import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { listaMaterialesMaterialesPedido } from '../../api/fn/lista-de-materiales/lista-materiales-materiales-pedido';
import { TotalMaterialDto } from '../../api/models/total-material-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { UtcPipe } from '../../core/ui/fechas';
import { ArbolMateriales, nombreTipo } from './arbol-materiales';

/** Filtro de los totales: lo que se fabrica (semiterminados) o lo que no tiene lista (materia prima, comprados). */
type VistaTotales = 'todos' | 'fabricados' | 'basicos';

/**
 * Semiterminados y materias primas que requiere un pedido según la lista de materiales, para la cantidad solicitada
 * de cada línea vigente, y cuánto falta después de descontar las existencias. Solo informa: no reserva inventario.
 */
@Component({
  selector: 'pi-materiales-pedido',
  imports: [
    ArbolMateriales,
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTableModule,
    RouterLink,
    UtcPipe,
  ],
  templateUrl: './materiales-pedido.html',
  styleUrl: './materiales-pedido.scss',
})
export class MaterialesPedido {
  private readonly api = inject(Api);

  /** Parámetro de la ruta /pedidos/:id/materiales. */
  readonly id = input.required<string>();

  protected readonly materiales = resource({
    params: () => ({ id: Number(this.id()) }),
    loader: ({ params }) =>
      this.api.invoke(
        listaMaterialesMaterialesPedido,
        params,
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly error = computed(() =>
    this.materiales.error() ? leerProblema(this.materiales.error()) : null,
  );

  protected readonly vista = signal<VistaTotales>('todos');
  protected readonly soloFaltantes = signal(false);
  protected readonly totales = computed(() => {
    const todos = (this.materiales.value()?.totales ?? []).filter(
      (t) => !this.soloFaltantes() || (t.faltante ?? 0) > 0,
    );
    switch (this.vista()) {
      case 'fabricados':
        return todos.filter((t) => t.tieneComponentes);
      case 'basicos':
        return todos.filter((t) => !t.tieneComponentes);
      default:
        return todos;
    }
  });
  protected readonly lineasSinLista = computed(
    () =>
      (this.materiales.value()?.lineas ?? []).filter((l) => !l.estructura?.componentes?.length)
        .length,
  );

  protected readonly columnas = [
    'codigo',
    'descripcion',
    'tipo',
    'bodega',
    'cantidad',
    'disponible',
    'faltante',
  ];

  // Las filas de mat-table no tienen tipo en la plantilla
  protected textoTipo(t: TotalMaterialDto): string {
    return nombreTipo(t.tipo);
  }

  protected claseTipo(t: TotalMaterialDto): string {
    return 'tipo ' + (t.tipo ?? 'SIN_TIPO');
  }
}
