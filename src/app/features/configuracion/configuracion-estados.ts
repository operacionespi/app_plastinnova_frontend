import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { CatalogoEstados } from './catalogo-estados';

/** Coordinación: catálogos de estados de pedido y de etapas de línea, con su flujo. */
@Component({
  selector: 'pi-configuracion-estados',
  imports: [CatalogoEstados, MatTabsModule],
  template: `
    <h1>Estados</h1>
    <mat-tab-group mat-stretch-tabs="false" animationDuration="0ms">
      <mat-tab label="Etapas de las líneas">
        <pi-catalogo-estados tipo="detalle" />
      </mat-tab>
      <mat-tab label="Estados de los pedidos">
        <pi-catalogo-estados tipo="pedido" />
      </mat-tab>
    </mat-tab-group>
  `,
  styles: `
    h1 {
      margin: 0 0 8px;
      font: var(--mat-sys-headline-small);
    }
  `,
})
export class ConfiguracionEstados {}
