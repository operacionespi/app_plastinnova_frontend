import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { FiltroLineaRequestDto } from '../../api/models/filtro-linea-request-dto';
import { ListaLineas } from './lista-lineas';

/**
 * Líneas pendientes de un pedido, buscadas por número (o por el inicio del número).
 * El número va en la URL (?numero=) para que atrás/adelante y recargar conserven la búsqueda.
 */
@Component({
  selector: 'pi-buscar-pedido',
  imports: [
    FormField,
    ListaLineas,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './buscar-pedido.html',
  styleUrl: './buscar-pedido.scss',
})
export class BuscarPedido {
  private readonly router = inject(Router);

  /** Parámetro de la URL. */
  readonly numero = input<string>();

  protected readonly datos = signal({ numero: '' });
  protected readonly formulario = form(this.datos);

  protected readonly buscado = computed(() => this.numero()?.trim() ?? '');
  protected readonly filtro = computed<FiltroLineaRequestDto | undefined>(() =>
    this.buscado() ? { numeroPedido: this.buscado() } : undefined,
  );

  constructor() {
    // El campo muestra lo que está en la URL (ej. al volver atrás)
    effect(() => this.datos.set({ numero: this.buscado() }));
  }

  protected buscar(evento: Event): void {
    evento.preventDefault();
    const numero = this.datos().numero.trim();
    void this.router.navigate([], { queryParams: { numero: numero || null } });
  }
}
