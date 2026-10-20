import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pi-no-encontrada',
  imports: [MatButtonModule, RouterLink],
  template: `
    <section class="mensaje-pagina">
      <h1>Página no encontrada</h1>
      <p>La dirección no existe. Use el menú para ir a otra pantalla.</p>
      <a matButton="filled" routerLink="/">Ir al inicio</a>
    </section>
  `,
  styleUrl: './mensaje-pagina.scss',
})
export class NoEncontrada {}
