import {
  atajoDelPeriodo,
  diasDelPeriodo,
  hoyEnPlanta,
  leerPeriodo,
  periodoDeAtajo,
  porcentaje,
  proporcion,
  rangoInvalido,
} from './periodo';
import { tablaProduccion } from './produccion';

describe('periodo de los tableros', () => {
  it('toma el día de la planta, no el de UTC', () => {
    expect(hoyEnPlanta(new Date('2026-10-15T02:00:00Z'))).toBe('2026-10-14'); // 9 p. m. del 14 en Colombia
    expect(hoyEnPlanta(new Date('2026-10-15T05:00:00Z'))).toBe('2026-10-15');
  });

  it('calcula los atajos incluyendo hoy', () => {
    expect(periodoDeAtajo('7', '2026-10-14')).toEqual({ desde: '2026-10-08', hasta: '2026-10-14' });
    expect(periodoDeAtajo('30', '2026-03-01')).toEqual({
      desde: '2026-01-31',
      hasta: '2026-03-01',
    });
    expect(periodoDeAtajo('mes', '2026-10-14')).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-14',
    });
    expect(periodoDeAtajo('anterior', '2026-03-31')).toEqual({
      desde: '2026-02-01',
      hasta: '2026-02-28',
    });
    expect(periodoDeAtajo('anterior', '2026-01-10')).toEqual({
      desde: '2025-12-01',
      hasta: '2025-12-31',
    });
    expect(diasDelPeriodo(periodoDeAtajo('90', '2026-10-14'))).toBe(90);
  });

  it('reconoce el atajo de un periodo', () => {
    expect(atajoDelPeriodo({ desde: '2026-10-01', hasta: '2026-10-14' }, '2026-10-14')).toBe('mes');
    expect(
      atajoDelPeriodo({ desde: '2026-10-02', hasta: '2026-10-14' }, '2026-10-14'),
    ).toBeUndefined();
  });

  it('usa los últimos 30 días si la URL no trae un rango válido', () => {
    const porDefecto = { desde: '2026-09-15', hasta: '2026-10-14' };
    expect(leerPeriodo(undefined, undefined, '2026-10-14')).toEqual(porDefecto);
    expect(leerPeriodo('2026-10-10', '2026-10-01', '2026-10-14')).toEqual(porDefecto);
    expect(leerPeriodo('2025-01-01', '2026-10-14', '2026-10-14')).toEqual(porDefecto); // más de 366 días
    expect(leerPeriodo('ayer', '2026-10-14', '2026-10-14')).toEqual(porDefecto);
    expect(leerPeriodo('2026-10-14', '2026-10-14', '2026-10-14')).toEqual({
      desde: '2026-10-14',
      hasta: '2026-10-14',
    });
  });

  it('explica por qué un rango no sirve', () => {
    expect(rangoInvalido({ desde: '', hasta: '2026-10-14' })).toBe('Elija las dos fechas.');
    expect(rangoInvalido({ desde: '2026-10-15', hasta: '2026-10-14' })).toBe(
      'La fecha inicial es posterior a la final.',
    );
    expect(rangoInvalido({ desde: '2025-10-13', hasta: '2026-10-14' })).toBe(
      'El periodo no puede pasar de 366 días.',
    );
    expect(rangoInvalido({ desde: '2025-10-14', hasta: '2026-10-14' })).toBeNull(); // 366 días
  });

  it('calcula porcentajes y barras sin dividir por cero', () => {
    expect(porcentaje(2, 3)).toBe(67);
    expect(porcentaje(0, 0)).toBeNull();
    expect(proporcion(5, 20)).toBe(25);
    expect(proporcion(5, 0)).toBe(0);
  });
});

describe('producción por operador', () => {
  it('arma operadores × etapas en el orden del proceso, del más productivo al menos', () => {
    const tabla = tablaProduccion(
      [
        {
          usuarioId: 1,
          usuarioNombre: 'Ana',
          estadoId: 5,
          estadoNombre: 'Calidad',
          piezas: 10,
          movimientos: 2,
        },
        {
          usuarioId: 2,
          usuarioNombre: 'Luis',
          estadoId: 3,
          estadoNombre: 'Ensamble',
          piezas: 30,
          movimientos: 3,
        },
        {
          usuarioId: 1,
          usuarioNombre: 'Ana',
          estadoId: 3,
          estadoNombre: 'Ensamble',
          piezas: 5,
          movimientos: 1,
        },
      ],
      new Map([
        [3, 30],
        [5, 50],
      ]),
    );
    expect(tabla.etapas).toEqual([
      { id: 3, nombre: 'Ensamble' },
      { id: 5, nombre: 'Calidad' },
    ]);
    expect(tabla.filas.map((f) => [f.nombre, f.totalPiezas, f.totalMovimientos])).toEqual([
      ['Luis', 30, 3],
      ['Ana', 15, 3],
    ]);
    expect(tabla.filas[1].etapas[5]).toEqual({ piezas: 10, movimientos: 2 });
    expect(tabla.filas[0].etapas[5]).toBeUndefined();
  });
});
