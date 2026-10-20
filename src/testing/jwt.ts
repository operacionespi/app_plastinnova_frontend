/** JWT sin firma válida (el frontend solo lee `exp`), que expira dentro de `ms` milisegundos. */
export function tokenQueExpiraEn(ms: number, sub = 'usuario@plastinnova.test'): string {
  const base64Url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor((Date.now() + ms) / 1000);
  return `${base64Url({ alg: 'HS256' })}.${base64Url({ sub, exp })}.firma`;
}

export const OPERADOR = {
  id: 2,
  email: 'operador@plastinnova.test',
  nombreCompleto: 'Olga Operadora',
  roles: ['OPERADOR'],
  permisos: ['detalle:cambiar-estado', 'pedido:ver'],
};

export const COORDINADOR = {
  id: 3,
  email: 'coordinador@plastinnova.test',
  nombreCompleto: 'Carlos Coordinador',
  roles: ['COORDINADOR'],
  permisos: [
    'detalle:cambiar-estado',
    'estado:gestionar',
    'kpi:ver',
    'pedido:asignar',
    'pedido:cambiar-estado',
    'pedido:fecha-entrega',
    'pedido:ver',
    'sync:ejecutar',
  ],
};

export const GERENTE = {
  id: 4,
  email: 'gerencia@plastinnova.test',
  nombreCompleto: 'Gloria Gerente',
  roles: ['GERENCIA'],
  permisos: ['kpi:ver', 'pedido:ver'],
};
