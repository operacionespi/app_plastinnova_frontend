export type Alistamiento = 'TODOS' | 'NACIONAL' | 'INTERNACIONAL';

/** Lo que eligió el operador en la tablet; se conserva entre sesiones (cada tablet suele quedarse en su área). */
export interface PreferenciasCola {
  etapaId?: number;
  alistamiento: Alistamiento;
}

const CLAVE = 'pi.cola';
const ALISTAMIENTOS: readonly Alistamiento[] = ['TODOS', 'NACIONAL', 'INTERNACIONAL'];

export function leerPreferenciasCola(): PreferenciasCola {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Partial<PreferenciasCola>;
    return {
      etapaId: typeof guardadas.etapaId === 'number' ? guardadas.etapaId : undefined,
      alistamiento: ALISTAMIENTOS.includes(guardadas.alistamiento as Alistamiento)
        ? (guardadas.alistamiento as Alistamiento)
        : 'TODOS',
    };
  } catch {
    return { alistamiento: 'TODOS' };
  }
}

export function guardarPreferenciasCola(preferencias: PreferenciasCola): void {
  localStorage.setItem(CLAVE, JSON.stringify(preferencias));
}
