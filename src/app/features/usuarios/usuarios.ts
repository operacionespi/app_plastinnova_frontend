import { UsuarioResponseDto } from '../../api/models/usuario-response-dto';
import { NOMBRES_ROL } from '../../core/navegacion/navegacion';

/** Para buscar sin importar tildes ni mayúsculas ("jose" encuentra a "José"). */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Pocos usuarios: se cargan todos y se filtran en pantalla, sin esperar al servidor en cada tecla. */
export function filtrarUsuarios(
  usuarios: readonly UsuarioResponseDto[],
  texto: string,
  incluirInactivos: boolean,
): UsuarioResponseDto[] {
  const buscado = normalizar(texto);
  return usuarios.filter(
    (u) =>
      (incluirInactivos || u.activo) &&
      (!buscado ||
        normalizar(u.nombreCompleto ?? '').includes(buscado) ||
        normalizar(u.email ?? '').includes(buscado)),
  );
}

export function nombreRol(codigo: string): string {
  return NOMBRES_ROL[codigo] ?? codigo;
}
