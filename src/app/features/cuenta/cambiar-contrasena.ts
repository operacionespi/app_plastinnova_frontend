import { HttpContext } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  minLength,
  maxLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { Api } from '../../api/api';
import { authCambiarContrasena } from '../../api/fn/auth-controller/auth-cambiar-contrasena';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { Sesion } from '../../core/auth/sesion';
import { Navegacion } from '../../core/navegacion/navegacion';
import { Avisos } from '../../core/ui/avisos';

@Component({
  selector: 'pi-cambiar-contrasena',
  imports: [FormField, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './cambiar-contrasena.html',
  styleUrl: './cambiar-contrasena.scss',
})
export class CambiarContrasena {
  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);
  private readonly navegacion = inject(Navegacion);
  protected readonly sesion = inject(Sesion);

  protected readonly datos = signal({ actual: '', nueva: '', confirmacion: '' });
  protected readonly formulario = form(this.datos, (d) => {
    required(d.actual, { message: 'Ingrese su contraseña actual.' });
    required(d.nueva, { message: 'Ingrese la contraseña nueva.' });
    // Mismas reglas que el backend (CambioContrasenaRequestDTO)
    minLength(d.nueva, 8, { message: 'Debe tener al menos 8 caracteres.' });
    maxLength(d.nueva, 72, { message: 'Debe tener máximo 72 caracteres.' });
    validate(d.nueva, ({ value, valueOf }) =>
      value() && value() === valueOf(d.actual)
        ? { kind: 'igualActual', message: 'Debe ser distinta de la actual.' }
        : undefined,
    );
    required(d.confirmacion, { message: 'Repita la contraseña nueva.' });
    validate(d.confirmacion, ({ value, valueOf }) =>
      value() && value() !== valueOf(d.nueva)
        ? { kind: 'noCoincide', message: 'No coincide con la contraseña nueva.' }
        : undefined,
    );
  });
  protected readonly error = signal<string | null>(null);

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const { actual, nueva } = this.datos();
      try {
        await this.api.invoke(
          authCambiarContrasena,
          { body: { contrasenaActual: actual, contrasenaNueva: nueva } },
          new HttpContext().set(MANEJA_ERRORES, true),
        );
        // Si era temporal, ahora sí tiene los permisos de sus roles
        if (this.sesion.debeCambiarContrasena()) {
          await this.sesion.recargarUsuario();
        }
        this.avisos.exito('Contraseña actualizada.');
        await this.router.navigateByUrl(this.navegacion.rutaInicio());
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
