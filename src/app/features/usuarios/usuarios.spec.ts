import { filtrarUsuarios, nombreRol, normalizar } from './usuarios';

describe('usuarios', () => {
  const usuarios = [
    { id: 1, nombreCompleto: 'José Pérez', email: 'jperez@plast-innova.com.co', activo: true },
    { id: 2, nombreCompleto: 'Ana Gómez', email: 'agomez@plast-innova.com.co', activo: false },
  ];

  it('busca por nombre o correo sin importar tildes ni mayúsculas', () => {
    expect(normalizar('  JOSÉ ')).toBe('jose');
    expect(filtrarUsuarios(usuarios, 'jose', true).map((u) => u.id)).toEqual([1]);
    expect(filtrarUsuarios(usuarios, 'AGOMEZ', true).map((u) => u.id)).toEqual([2]);
    expect(filtrarUsuarios(usuarios, '', true).map((u) => u.id)).toEqual([1, 2]);
  });

  it('oculta los inactivos salvo que se pidan', () => {
    expect(filtrarUsuarios(usuarios, '', false).map((u) => u.id)).toEqual([1]);
    expect(filtrarUsuarios(usuarios, 'gomez', false)).toEqual([]);
  });

  it('muestra el nombre del rol', () => {
    expect(nombreRol('SUPERVISOR')).toBe('Supervisor');
    expect(nombreRol('NUEVO')).toBe('NUEVO');
  });
});
