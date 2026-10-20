import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../api/api';
import { authAuthenticate } from '../../api/fn/auth-controller/auth-authenticate';
import { authUsuarioActual } from '../../api/fn/auth-controller/auth-usuario-actual';
import { UsuarioActualDto } from '../../api/models/usuario-actual-dto';
import { MANEJA_ERRORES } from '../http/contexto';
import { expiracionJwt } from './jwt';

const CLAVE_TOKEN = 'pi.token';

/**
 * Sesión del usuario: token JWT (en localStorage, para que la tablet no pida ingresar en cada recarga)
 * y datos de /auth/me (nombre, roles y permisos) con los que se arma el menú y se protegen las rutas.
 */
@Service()
export class Sesion {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(null);
  private readonly _usuario = signal<UsuarioActualDto | null>(null);
  private temporizadorExpiracion?: ReturnType<typeof setTimeout>;

  readonly token = this._token.asReadonly();
  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);
  readonly roles = computed(() => new Set(this._usuario()?.roles ?? []));
  private readonly permisos = computed(() => new Set(this._usuario()?.permisos ?? []));
  /** Entró con una contraseña temporal (creada o restablecida por el administrador): sin permisos hasta cambiarla. */
  readonly debeCambiarContrasena = computed(() => !!this._usuario()?.debeCambiarContrasena);

  tienePermiso(permiso: string): boolean {
    return this.permisos().has(permiso);
  }

  /** Al arrancar la app: si hay un token vigente guardado, recupera el usuario. */
  async restaurar(): Promise<void> {
    const guardado = localStorage.getItem(CLAVE_TOKEN);
    if (!guardado || !this.programarExpiracion(guardado)) {
      this.limpiar();
      return;
    }
    this._token.set(guardado);
    try {
      await this.cargarUsuario();
    } catch (error) {
      // Token rechazado o usuario desactivado: se pide ingresar de nuevo. Sin conexión se conserva el token.
      if (!(error instanceof HttpErrorResponse) || error.status !== 0) {
        this.limpiar();
      }
    }
  }

  /** Los errores (credenciales inválidas, sin conexión) se propagan para mostrarlos en el formulario. */
  async iniciarSesion(email: string, password: string): Promise<void> {
    const respuesta = await this.api.invoke(
      authAuthenticate,
      { body: { email, password } },
      conManejoLocal(),
    );
    const token = respuesta.accessToken;
    if (!token || !this.programarExpiracion(token)) {
      throw new Error('El servidor devolvió un token inválido.');
    }
    this._token.set(token);
    try {
      await this.cargarUsuario();
    } catch (error) {
      this.limpiar();
      throw error;
    }
    localStorage.setItem(CLAVE_TOKEN, token);
  }

  cerrarSesion(motivo?: 'expirada'): void {
    this.limpiar();
    void this.router.navigate(['/login'], motivo ? { queryParams: { motivo } } : {});
  }

  /** Tras cambiar la contraseña temporal: el backend devuelve ya los permisos de sus roles. */
  async recargarUsuario(): Promise<void> {
    await this.cargarUsuario();
  }

  private async cargarUsuario(): Promise<void> {
    this._usuario.set(await this.api.invoke(authUsuarioActual, undefined, conManejoLocal()));
  }

  /** @returns false si el token ya expiró o no se puede leer */
  private programarExpiracion(token: string): boolean {
    const expira = expiracionJwt(token);
    const restante = expira === null ? -1 : expira - Date.now();
    clearTimeout(this.temporizadorExpiracion);
    if (restante <= 0) {
      return false;
    }
    this.temporizadorExpiracion = setTimeout(() => this.cerrarSesion('expirada'), restante);
    return true;
  }

  private limpiar(): void {
    clearTimeout(this.temporizadorExpiracion);
    localStorage.removeItem(CLAVE_TOKEN);
    this._token.set(null);
    this._usuario.set(null);
  }
}

function conManejoLocal(): HttpContext {
  return new HttpContext().set(MANEJA_ERRORES, true);
}
