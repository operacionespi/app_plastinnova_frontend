import { formatDate, registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { DiaPipe, instanteUtc, UtcPipe, ZONA_PLANTA } from './fechas';

registerLocaleData(localeEsCo);

describe('fechas', () => {
  it('interpreta las fechas con hora del backend como UTC', () => {
    expect(instanteUtc('2026-10-13T18:30:00').toISOString()).toBe('2026-10-13T18:30:00.000Z');
    // Hora de la planta: 5 horas menos
    expect(formatDate(instanteUtc('2026-10-14T02:00:00'), 'd/MM HH:mm', 'es-CO', ZONA_PLANTA)).toBe(
      '13/10 21:00',
    );
  });

  it('respeta la zona si el texto ya la trae', () => {
    expect(instanteUtc('2026-10-13T18:30:00-05:00').toISOString()).toBe('2026-10-13T23:30:00.000Z');
    expect(new UtcPipe().transform(null)).toBeNull();
  });

  it('muestra las fechas sin hora en el mismo día en cualquier zona', () => {
    const dia = new DiaPipe().transform('2026-10-13')!;
    for (const zona of [ZONA_PLANTA, 'UTC', '+1000', '-1000']) {
      expect(formatDate(dia, 'yyyy-MM-dd', 'es-CO', zona)).toBe('2026-10-13');
    }
  });
});
