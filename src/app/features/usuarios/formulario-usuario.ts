import { HttpContext } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  email,
  form,
  FormField,
  maxLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { usuarioActualizar } from '../../api/fn/usuarios/usuario-actualizar';
import { usuarioCrear } from '../../api/fn/usuarios/usuario-crear';
import { ContrasenaTemporalResponseDto } from '../../api/models/contrasena-temporal-response-dto';
import { RolResponseDto } from '../../api/models/rol-response-dto';
import { UsuarioResponseDto } from '../../api/models/usuario-response-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { nombreRol } from './usuarios';

export interface DatosFormularioUsuario {
  roles: readonly RolResponseDto[];
  /** Sin usuario: creación. */
  usuario?: UsuarioResponseDto;
  /** El administrador editándose a sí mismo: no puede quitarse el rol de Administrador. */
  esPropio?: boolean;
}

/** Al crear devuelve la contraseña temporal; al editar, el usuario actualizado. */
export type ResultadoFormularioUsuario = ContrasenaTemporalResponseDto | UsuarioResponseDto;

@Component({
  selector: 'pi-formulario-usuario',
  imports: [
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './formulario-usuario.html',
  styleUrl: './formulario-usuario.scss',
})
export class FormularioUsuario {
  private readonly api = inject(Api);
  private readonly dialogo = inject(MatDialogRef<FormularioUsuario, ResultadoFormularioUsuario>);
  protected readonly entrada = inject<DatosFormularioUsuario>(MAT_DIALOG_DATA);
  protected readonly edicion = !!this.entrada.usuario;
  protected readonly nombreRol = nombreRol;

  protected readonly datos = signal({
    email: this.entrada.usuario?.email ?? '',
    nombreCompleto: this.entrada.usuario?.nombreCompleto ?? '',
    roles: [...(this.entrada.usuario?.roles ?? [])],
  });
  // Mismas reglas que el backend (UsuarioCreacionRequestDTO / UsuarioEdicionRequestDTO)
  protected readonly formulario = form(this.datos, (d) => {
    required(d.email, { message: 'Escriba el correo.' });
    email(d.email, { message: 'El correo no es válido.' });
    maxLength(d.email, 150, { message: 'Máximo 150 caracteres.' });
    required(d.nombreCompleto, { message: 'Escriba el nombre.' });
    maxLength(d.nombreCompleto, 150, { message: 'Máximo 150 caracteres.' });
    validate(d.roles, ({ value }) =>
      value().length ? undefined : { kind: 'sinRoles', message: 'Asigne al menos un rol.' },
    );
  });
  protected readonly error = signal<string | null>(null);

  protected tieneRol(codigo: string): boolean {
    return this.datos().roles.includes(codigo);
  }

  protected bloqueado(codigo: string): boolean {
    return !!this.entrada.esPropio && codigo === 'ADMIN';
  }

  protected alternarRol(codigo: string, marcado: boolean): void {
    this.formulario.roles().markAsTouched();
    this.datos.update((d) => ({
      ...d,
      roles: marcado ? [...d.roles, codigo] : d.roles.filter((r) => r !== codigo),
    }));
  }

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(null);
    await submit(this.formulario, async () => {
      const { email: correo, nombreCompleto, roles } = this.datos();
      const contexto = new HttpContext().set(MANEJA_ERRORES, true);
      try {
        const resultado = this.entrada.usuario
          ? await this.api.invoke(
              usuarioActualizar,
              {
                id: this.entrada.usuario.id ?? 0,
                body: { nombreCompleto: nombreCompleto.trim(), roles },
              },
              contexto,
            )
          : await this.api.invoke(
              usuarioCrear,
              {
                body: {
                  email: correo.trim().toLowerCase(),
                  nombreCompleto: nombreCompleto.trim(),
                  roles,
                },
              },
              contexto,
            );
        this.dialogo.close(resultado);
      } catch (e) {
        this.error.set(leerProblema(e).mensaje);
      }
      return undefined;
    });
  }
}
