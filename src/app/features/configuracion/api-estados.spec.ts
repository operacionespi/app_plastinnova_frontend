import { codigoDesdeNombre } from './api-estados';
import { duracion } from './sincronizacion';

describe('configuración', () => {
  it('propone el código del estado igual que lo normaliza el backend', () => {
    expect(codigoDesdeNombre('En ensamble')).toBe('EN_ENSAMBLE');
    expect(codigoDesdeNombre('  Almacén 1 ')).toBe('ALMACEN_1');
    expect(codigoDesdeNombre('Revisión / calidad')).toBe('REVISION_CALIDAD');
  });

  it('muestra la duración de una ejecución', () => {
    expect(duracion('2026-10-13T10:00:00', '2026-10-13T10:00:45')).toBe('45 s');
    expect(duracion('2026-10-13T10:00:00', '2026-10-13T10:03:35')).toBe('3 min 35 s');
    expect(duracion('2026-10-13T10:00:00', undefined)).toBe('—');
  });
});
