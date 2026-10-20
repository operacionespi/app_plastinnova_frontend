import { HttpContext } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, min, pattern, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { EstadoCatalogoResponseDto } from '../../api/models/estado-catalogo-response-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { API_ESTADOS, codigoDesdeNombre, TipoCatalogo } from './api-estados';

export interface DatosFormularioEstado {
  tipo: TipoCatalogo;
  /** Sin estado: se crea uno nuevo. */
  estado?: EstadoCatalogoResponseDto;
  /** Para proponer el orden de un estado nuevo (después del último). */
  siguienteOrden: number;
}

interface Modelo {
  nombre: string;
  codigo: string;
  descripcion: string;
  ordenLogico: number | null;
  color: string;
  esInicial: boolean;
  esFinal: boolean;
}

/** Crea o modifica un estado del catálogo. Devuelve el estado guardado. */
@Component({
  selector: 'pi-formulario-estado',
  imports: [
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './formulario-estado.html',
  styleUrl: './dialogo-configuracion.scss',
})
export class FormularioEstado {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<FormularioEstado, EstadoCatalogoResponseDto>);
  protected readonly datosDialogo = inject<DatosFormularioEstado>(MAT_DIALOG_DATA);
  protected readonly nuevo = !this.datosDialogo.estado;
  /** En un estado nuevo el código sigue al nombre hasta que el usuario lo edita. */
  private codigoEditado = !this.nuevo;

  protected readonly datos = signal<Modelo>({
    nombre: this.datosDialogo.estado?.nombre ?? '',
    codigo: this.datosDialogo.estado?.codigo ?? '',
    descripcion: this.datosDialogo.estado?.descripcion ?? '',
    ordenLogico: this.datosDialogo.estado?.ordenLogico ?? this.datosDialogo.siguienteOrden,
    color: this.datosDialogo.estado?.color ?? '#9E9E9E',
    esInicial: this.datosDialogo.estado?.esInicial ?? false,
    esFinal: this.datosDialogo.estado?.esFinal ?? false,
  });
  // Mismas reglas que el backend (EstadoCatalogoRequestDTO)
  protected readonly formulario = form(this.datos, (d) => {
    required(d.nombre, { message: 'Ingrese el nombre.' });
    maxLength(d.nombre, 100, { message: 'Máximo 100 caracteres.' });
    required(d.codigo, { message: 'Ingrese el código.' });
    maxLength(d.codigo, 50, { message: 'Máximo 50 caracteres.' });
    maxLength(d.descripcion, 255, { message: 'Máximo 255 caracteres.' });
    required(d.ordenLogico, { message: 'Ingrese el orden.' });
    min(d.ordenLogico, 0, { message: 'No puede ser negativo.' });
    pattern(d.color, /^#[0-9A-Fa-f]{6}$/, { message: 'Use el formato #RRGGBB.' });
  });
  protected readonly error = signal<string | null>(null);

  protected cambioNombre(): void {
    if (!this.codigoEditado) {
      this.datos.update((d) => ({ ...d, codigo: codigoDesdeNombre(d.nombre) }));
    }
  }

  protected cambioCodigo(): void {
    this.codigoEditado = true;
  }

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const d = this.datos();
      const body = {
        nombre: d.nombre.trim(),
        codigo: d.codigo.trim(),
        descripcion: d.descripcion.trim() || undefined,
        ordenLogico: d.ordenLogico ?? 0,
        color: d.color,
        esInicial: d.esInicial,
        esFinal: d.esFinal,
      };
      const api = API_ESTADOS[this.datosDialogo.tipo];
      const contexto = new HttpContext().set(MANEJA_ERRORES, true);
      try {
        const guardado = this.datosDialogo.estado
          ? await this.api.invoke(
              api.actualizar,
              { id: this.datosDialogo.estado.id ?? 0, body },
              contexto,
            )
          : await this.api.invoke(api.crear, { body }, contexto);
        this.dialogo.close(guardado);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
