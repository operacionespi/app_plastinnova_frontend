import { DatePipe } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../api/api';
import { usuarioActivar } from '../../api/fn/usuarios/usuario-activar';
import { usuarioDesactivar } from '../../api/fn/usuarios/usuario-desactivar';
import { usuarioListar } from '../../api/fn/usuarios/usuario-listar';
import { usuarioRestablecerContrasena } from '../../api/fn/usuarios/usuario-restablecer-contrasena';
import { usuarioRoles } from '../../api/fn/usuarios/usuario-roles';
import { ContrasenaTemporalResponseDto } from '../../api/models/contrasena-temporal-response-dto';
import { UsuarioResponseDto } from '../../api/models/usuario-response-dto';
import { Sesion } from '../../core/auth/sesion';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { Avisos } from '../../core/ui/avisos';
import { Confirmacion, DatosConfirmacion } from '../../core/ui/confirmacion';
import { UtcPipe } from '../../core/ui/fechas';
import { ContrasenaTemporal, DatosContrasenaTemporal } from './contrasena-temporal';
import {
  DatosFormularioUsuario,
  FormularioUsuario,
  ResultadoFormularioUsuario,
} from './formulario-usuario';
import { filtrarUsuarios, nombreRol } from './usuarios';

const SIN_AVISOS = () => new HttpContext().set(MANEJA_ERRORES, true);

/** Administrador: usuarios, sus roles, activación y contraseñas temporales. */
@Component({
  selector: 'pi-gestion-usuarios',
  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTableModule,
    UtcPipe,
  ],
  templateUrl: './gestion-usuarios.html',
  styleUrl: './gestion-usuarios.scss',
})
export class GestionUsuarios {
  private readonly api = inject(Api);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  private readonly sesion = inject(Sesion);
  protected readonly nombreRol = nombreRol;

  protected readonly usuarios = resource({
    loader: () => this.api.invoke(usuarioListar, { incluirInactivos: true }, SIN_AVISOS()),
  });
  protected readonly roles = resource({
    loader: () => this.api.invoke(usuarioRoles, undefined, SIN_AVISOS()),
  });
  protected readonly error = computed(() => {
    const e = this.usuarios.error() ?? this.roles.error();
    return e ? leerProblema(e).mensaje : null;
  });

  protected readonly texto = signal('');
  protected readonly incluirInactivos = signal(false);
  protected readonly visibles = computed(() =>
    filtrarUsuarios(this.usuarios.value() ?? [], this.texto(), this.incluirInactivos()),
  );
  protected readonly inactivos = computed(
    () => (this.usuarios.value() ?? []).filter((u) => !u.activo).length,
  );

  protected readonly columnas = ['nombre', 'roles', 'estado', 'creado', 'acciones'];

  protected esPropio(u: UsuarioResponseDto): boolean {
    return u.id === this.sesion.usuario()?.id;
  }

  protected nuevo(): void {
    this.abrirFormulario({ roles: this.roles.value() ?? [] }, (r) => {
      const creado = r as ContrasenaTemporalResponseDto;
      this.mostrarContrasena('Usuario creado', creado);
    });
  }

  protected editar(u: UsuarioResponseDto): void {
    this.abrirFormulario(
      { roles: this.roles.value() ?? [], usuario: u, esPropio: this.esPropio(u) },
      () => this.avisos.exito(`Usuario ${u.email} actualizado.`),
    );
  }

  protected async restablecer(u: UsuarioResponseDto): Promise<void> {
    const confirmado = await this.confirmar({
      titulo: 'Restablecer contraseña',
      mensaje:
        `Se genera una contraseña temporal para ${u.nombreCompleto}. Su contraseña actual deja de ` +
        'servir, se cierran sus sesiones abiertas y deberá cambiar la temporal al ingresar.',
      accion: 'Restablecer',
    });
    if (confirmado) {
      await this.ejecutar(async () => {
        const r = await this.api.invoke(
          usuarioRestablecerContrasena,
          { id: u.id ?? 0 },
          SIN_AVISOS(),
        );
        this.mostrarContrasena('Contraseña restablecida', r);
      });
    }
  }

  protected async desactivar(u: UsuarioResponseDto): Promise<void> {
    const confirmado = await this.confirmar({
      titulo: `Desactivar a ${u.nombreCompleto}`,
      mensaje:
        'No podrá ingresar y sus sesiones abiertas se cierran de inmediato. Lo que ya registró se ' +
        'conserva en el historial. Puede activarlo de nuevo cuando quiera.',
      accion: 'Desactivar',
    });
    if (confirmado) {
      await this.ejecutar(async () => {
        await this.api.invoke(usuarioDesactivar, { id: u.id ?? 0 }, SIN_AVISOS());
        this.avisos.exito(`${u.nombreCompleto} quedó inactivo.`);
      });
    }
  }

  protected async activar(u: UsuarioResponseDto): Promise<void> {
    await this.ejecutar(async () => {
      await this.api.invoke(usuarioActivar, { id: u.id ?? 0 }, SIN_AVISOS());
      this.avisos.exito(`${u.nombreCompleto} quedó activo.`);
    });
  }

  private abrirFormulario(
    datos: DatosFormularioUsuario,
    alGuardar: (r: ResultadoFormularioUsuario) => void,
  ): void {
    this.dialogos
      .open<FormularioUsuario, DatosFormularioUsuario, ResultadoFormularioUsuario>(
        FormularioUsuario,
        { data: datos, width: '560px', maxWidth: '95vw' },
      )
      .afterClosed()
      .subscribe((r) => {
        if (r) {
          alGuardar(r);
          this.usuarios.reload();
        }
      });
  }

  private mostrarContrasena(titulo: string, resultado: ContrasenaTemporalResponseDto): void {
    this.dialogos.open<ContrasenaTemporal, DatosContrasenaTemporal>(ContrasenaTemporal, {
      data: { titulo, resultado },
      width: '520px',
      maxWidth: '95vw',
      disableClose: true,
    });
  }

  /** Errores de negocio (409) como aviso; siempre recarga para reflejar el estado real. */
  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    try {
      await accion();
    } catch (e) {
      this.avisos.error(leerProblema(e).mensaje);
    }
    this.usuarios.reload();
  }

  private confirmar(datos: DatosConfirmacion): Promise<boolean | undefined> {
    return firstValueFrom(
      this.dialogos
        .open<Confirmacion, DatosConfirmacion, boolean>(Confirmacion, {
          data: datos,
          width: '440px',
        })
        .afterClosed(),
    );
  }
}
