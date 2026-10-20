import { guardarPreferenciasCola, leerPreferenciasCola } from './preferencias-cola';

describe('preferencias de la cola', () => {
  beforeEach(() => localStorage.clear());

  it('usa valores por defecto si no hay nada guardado o está dañado', () => {
    expect(leerPreferenciasCola()).toEqual({ etapaId: undefined, alistamiento: 'TODOS' });
    localStorage.setItem('pi.cola', '{no es json');
    expect(leerPreferenciasCola()).toEqual({ alistamiento: 'TODOS' });
    localStorage.setItem('pi.cola', JSON.stringify({ etapaId: 'x', alistamiento: 'OTRO' }));
    expect(leerPreferenciasCola()).toEqual({ etapaId: undefined, alistamiento: 'TODOS' });
  });

  it('conserva lo guardado', () => {
    guardarPreferenciasCola({ etapaId: 4, alistamiento: 'NACIONAL' });
    expect(leerPreferenciasCola()).toEqual({ etapaId: 4, alistamiento: 'NACIONAL' });
  });
});
