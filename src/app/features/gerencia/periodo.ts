/** Periodo de los indicadores: días calendario de la planta, ambos incluidos ('yyyy-MM-dd'). */
export interface Periodo {
  desde: string;
  hasta: string;
}

export type Atajo = '7' | '30' | '90' | 'mes' | 'anterior';

export const ATAJOS: readonly { valor: Atajo; etiqueta: string }[] = [
  { valor: '7', etiqueta: '7 días' },
  { valor: '30', etiqueta: '30 días' },
  { valor: '90', etiqueta: '90 días' },
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: 'anterior', etiqueta: 'Mes anterior' },
];

/** El backend no acepta rangos de más de 366 días. */
export const MAXIMO_DIAS = 366;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

/** Hoy en la planta (UTC-5 fijo, ver ZONA_PLANTA): a las 9 p. m. en Colombia ya es mañana en UTC. */
export function hoyEnPlanta(ahora = new Date()): string {
  return new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

function sumarDias(dia: string, dias: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
}

export function diasDelPeriodo(p: Periodo): number {
  return Math.round((Date.parse(p.hasta) - Date.parse(p.desde)) / DIA_MS) + 1;
}

/** Los atajos de "N días" terminan hoy e incluyen hoy. */
export function periodoDeAtajo(atajo: Atajo, hoy: string): Periodo {
  const [anio, mes] = hoy.split('-').map(Number);
  const primeroDelMes = `${hoy.slice(0, 8)}01`;
  switch (atajo) {
    case 'mes':
      return { desde: primeroDelMes, hasta: hoy };
    case 'anterior': {
      const desde = new Date(Date.UTC(anio, mes - 2, 1)).toISOString().slice(0, 10);
      return { desde, hasta: sumarDias(primeroDelMes, -1) };
    }
    default:
      return { desde: sumarDias(hoy, -(Number(atajo) - 1)), hasta: hoy };
  }
}

export function atajoDelPeriodo(p: Periodo, hoy: string): Atajo | undefined {
  return ATAJOS.map((a) => a.valor).find((a) => {
    const candidato = periodoDeAtajo(a, hoy);
    return candidato.desde === p.desde && candidato.hasta === p.hasta;
  });
}

/** Sin parámetros, o si no son un rango válido, se muestran los últimos 30 días. */
export function leerPeriodo(
  desde: string | undefined,
  hasta: string | undefined,
  hoy: string,
): Periodo {
  const periodo = { desde: desde ?? '', hasta: hasta ?? '' };
  return rangoInvalido(periodo) ? periodoDeAtajo('30', hoy) : periodo;
}

/** Mensaje para el usuario si las fechas no forman un periodo que el backend acepte. */
export function rangoInvalido(p: Periodo): string | null {
  if (!FECHA.test(p.desde) || !FECHA.test(p.hasta)) {
    return 'Elija las dos fechas.';
  }
  if (p.desde > p.hasta) {
    return 'La fecha inicial es posterior a la final.';
  }
  return diasDelPeriodo(p) > MAXIMO_DIAS
    ? `El periodo no puede pasar de ${MAXIMO_DIAS} días.`
    : null;
}

/** Parte de un total en porcentaje entero; null si no hay base para calcularlo. */
export function porcentaje(parte = 0, total = 0): number | null {
  return total > 0 ? Math.round((parte / total) * 100) : null;
}

/** Ancho de una barra respecto al mayor valor de la serie (0–100). */
export function proporcion(valor = 0, maximo = 0): number {
  return maximo > 0 ? (valor / maximo) * 100 : 0;
}
