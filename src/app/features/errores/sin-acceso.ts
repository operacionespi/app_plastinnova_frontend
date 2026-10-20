import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pi-sin-acceso',
  imports: [MatButtonModule, RouterLink],
  template: `
    <section class="mensaje-pagina">
      <h1>Sin acceso</h1>
      <p>
        Su usuario no tiene permiso para ver esta pantalla. Si lo necesita, pídalo al administrador.
      </p>
      <a matButton="filled" routerLink="/">Ir al inicio</a>
    </section>
  `,
  styleUrl: './mensaje-pagina.scss',
})
export class SinAcceso {}
