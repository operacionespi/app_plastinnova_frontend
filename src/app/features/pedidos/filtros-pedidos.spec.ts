import { aFiltroApi, aParametros, leerFiltros, leerOrden, leerPagina } from './filtros-pedidos';

describe('filtros del listado de pedidos', () => {
  it('por defecto muestra los pedidos abiertos', () => {
    const f = leerFiltros({});
    expect(f).toEqual({
      numero: '',
      ciudad: '',
      vendedores: [],
      estadosIds: [],
      desde: '',
      hasta: '',
      soloAbiertos: true,
      soloAtrasados: false,
    });
    expect(aFiltroApi(f)).toEqual({
      numeroPedido: undefined,
      ciudad: undefined,
      vendedores: undefined,
      estadosIds: undefined,
      fechaDesde: undefined,
      fechaHasta: undefined,
      soloAbiertos: true,
      soloAtrasados: undefined,
    });
    expect(aParametros(f, null)).toEqual({
      numero: null,
      ciudad: null,
      vendedor: null,
      estados: null,
      desde: null,
      hasta: null,
      abiertos: null,
      atrasados: null,
      pagina: null,
      orden: null,
    });
  });

  it('lee y escribe la URL descartando valores inválidos', () => {
    const f = leerFiltros({
      numero: ' 2045 ',
      ciudad: ' Cali ',
      vendedor: [' Ana Pérez ', 'Gómez, Luis', 'Ana Pérez', ' '],
      estados: '3,x,1,-2',
      desde: '2026-10-01',
      hasta: '13/10/2026',
      abiertos: '0',
      atrasados: '1',
    });
    expect(f).toEqual({
      numero: '2045',
      ciudad: 'Cali',
      vendedores: ['Ana Pérez', 'Gómez, Luis'],
      estadosIds: [3, 1],
      desde: '2026-10-01',
      hasta: '',
      soloAbiertos: false,
      soloAtrasados: true,
    });
    expect(aParametros(f, { campo: 'fechaEstimadaEntrega', direccion: 'asc' })).toMatchObject({
      numero: '2045',
      ciudad: 'Cali',
      vendedor: ['Ana Pérez', 'Gómez, Luis'],
      estados: '3,1',
      abiertos: '0',
      atrasados: '1',
      orden: 'fechaEstimadaEntrega,asc',
    });
  });

  it('un solo vendedor en la URL llega como texto', () => {
    expect(leerFiltros({ vendedor: 'Ana Pérez' }).vendedores).toEqual(['Ana Pérez']);
    expect(aFiltroApi(leerFiltros({ vendedor: 'Ana Pérez' })).vendedores).toEqual(['Ana Pérez']);
  });

  it('solo acepta campos de orden permitidos por el backend y páginas válidas', () => {
    expect(leerOrden('numeroPedido,desc')).toEqual({ campo: 'numeroPedido', direccion: 'desc' });
    expect(leerOrden('cliente,asc')).toBeNull();
    expect(leerOrden('numeroPedido,arriba')).toBeNull();
    expect(leerPagina('3')).toBe(3);
    expect(leerPagina('-1')).toBe(0);
    expect(leerPagina('abc')).toBe(0);
  });
});
