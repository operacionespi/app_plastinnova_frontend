import { Pipe, PipeTransform } from '@angular/core';

/** Colombia no tiene horario de verano: la hora de la planta siempre es UTC-5. Ver DATE_PIPE_DEFAULT_OPTIONS. */
export const ZONA_PLANTA = '-0500';

/** El backend guarda y envía las fechas con hora en UTC, sin indicar la zona (LocalDateTime). */
export function instanteUtc(texto: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(texto) ? texto : `${texto}Z`);
}

/** `{{ fechaCambio | utc | date: 'short' }}`: fecha con hora del backend → hora de la planta. */
@Pipe({ name: 'utc' })
export class UtcPipe implements PipeTransform {
  transform(texto: string | null | undefined): Date | null {
    return texto ? instanteUtc(texto) : null;
  }
}

/**
 * `{{ fechaEntrega | dia | date: 'd MMM' }}`: fecha sin hora (LocalDate, 'yyyy-MM-dd'). Se ubica al mediodía UTC
 * para que ninguna zona horaria la corra al día anterior o al siguiente.
 */
@Pipe({ name: 'dia' })
export class DiaPipe implements PipeTransform {
  transform(texto: string | null | undefined): Date | null {
    return texto ? new Date(`${texto}T12:00:00Z`) : null;
  }
}
