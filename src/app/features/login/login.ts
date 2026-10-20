import { Component, computed, inject, input, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { Sesion } from '../../core/auth/sesion';
import { leerProblema } from '../../core/http/problema';
import { Navegacion } from '../../core/navegacion/navegacion';

@Component({
  selector: 'pi-login',
  imports: [
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly sesion = inject(Sesion);
  private readonly navegacion = inject(Navegacion);
  private readonly router = inject(Router);

  /** Query params: ruta a la que se intentó entrar sin sesión, y motivo del cierre de sesión. */
  readonly volver = input<string>();
  readonly motivo = input<string>();

  protected readonly credenciales = signal({ email: '', password: '' });
  protected readonly formulario = form(this.credenciales, (c) => {
    required(c.email, { message: 'Ingrese su email.' });
    email(c.email, { message: 'Ingrese un email válido.' });
    required(c.password, { message: 'Ingrese su contraseña.' });
  });
  protected readonly verContrasena = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sesionExpirada = computed(
    () => this.motivo() === 'expirada' && this.error() === null,
  );

  protected async ingresar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      try {
        const { email, password } = this.credenciales();
        await this.sesion.iniciarSesion(email.trim(), password);
        await this.router.navigateByUrl(this.destino());
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }

  /** Solo rutas internas: evita redirigir a otro sitio con un parámetro manipulado. */
  private destino(): string {
    const volver = this.volver();
    return volver?.startsWith('/') && !volver.startsWith('//') && !volver.startsWith('/login')
      ? volver
      : this.navegacion.rutaInicio();
  }
}
