import { inject, Service } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Mensajes breves al pie de la pantalla. */
@Service()
export class Avisos {
  private readonly snackBar = inject(MatSnackBar);

  exito(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
  }

  /** Los errores permanecen hasta que el usuario los cierra: en planta puede no estar mirando la pantalla. */
  error(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', { panelClass: 'aviso-error', politeness: 'assertive' });
  }
}
