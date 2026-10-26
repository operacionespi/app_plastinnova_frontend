import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../api/api';
import { rutaProduccionEliminar } from '../../api/fn/rutas-de-produccion/ruta-produccion-eliminar';
import { rutaProduccionListar } from '../../api/fn/rutas-de-produccion/ruta-produccion-listar';
import { rutaProduccionProcesos } from '../../api/fn/rutas-de-produccion/ruta-produccion-procesos';
import { RutaProduccionDto } from '../../api/models/ruta-produccion-dto';
import { Sesion } from '../../core/auth/sesion';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { Avisos } from '../../core/ui/avisos';
import { Confirmacion, DatosConfirmacion } from '../../core/ui/confirmacion';
import { DatosRuta, FormularioRuta } from './formulario-ruta';
import { ItemsRuta } from './items-ruta';

/** Catálogo de rutas: qué procesos recorre cada ítem. Los ítems sin ruta recorren todos. */
@Component({
  selector: 'pi-rutas-produccion',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, RouterLink],
  template: `
    <a matButton class="volver" routerLink="/produccion">
      <mat-icon>arrow_back</mat-icon>
      Órdenes de producción
    </a>
    <div class="cabecera">
      <h1>Rutas de producción</h1>
      <span class="espacio"></span>
      @if (puedeGestionar && procesos.hasValue()) {
        <button matButton="filled" type="button" (click)="editar()">
          <mat-icon>add</mat-icon>
          Nueva ruta
        </button>
      }
    </div>
    @if (procesos.value(); as p) {
      <p class="ayuda">
        Una ruta dice qué procesos recorre un ítem y en qué orden; después del último va a
        {{ p.recepcion?.nombre }}. Los ítems sin ruta recorren todos:
        @for (e of p.procesos ?? []; track e.id) {
          {{ e.nombre }} →
        }
        {{ p.recepcion?.nombre }}. Cambiar una ruta no afecta las órdenes ya creadas.
      </p>
    }

    @if (error(); as mensaje) {
      <div class="mensaje-error" role="alert">
        <span>{{ mensaje }}</span>
        <button matButton type="button" (click)="rutas.reload()">Reintentar</button>
      </div>
    } @else if (rutas.hasValue()) {
      <ul class="rutas">
        @for (r of rutas.value(); track r.id) {
          <li [class.inactiva]="!r.activa">
            <div class="datos">
              <h2>
                {{ r.nombre }}
                @if (!r.activa) {
                  <span class="etiqueta">Inactiva</span>
                }
              </h2>
              @if (r.descripcion) {
                <span class="secundario">{{ r.descripcion }}</span>
              }
              <ol class="pasos" [attr.aria-label]="'Procesos de ' + r.nombre">
                @for (e of r.etapas ?? []; track e.id) {
                  <li>
                    <span
                      class="punto"
                      aria-hidden="true"
                      [style.background-color]="e.color ?? null"
                    ></span>
                    {{ e.nombre }}
                  </li>
                }
                <li class="final">{{ procesos.value()?.recepcion?.nombre }}</li>
              </ol>
            </div>
            <div class="acciones">
              <button matButton="tonal" type="button" (click)="items(r)">
                <mat-icon>inventory_2</mat-icon>
                {{ r.items }} {{ r.items === 1 ? 'ítem' : 'ítems' }}
              </button>
              @if (puedeGestionar) {
                <button matButton="outlined" type="button" (click)="editar(r)">
                  <mat-icon>edit</mat-icon>
                  Editar
                </button>
                <button
                  matIconButton
                  type="button"
                  [attr.aria-label]="'Eliminar la ruta ' + r.nombre"
                  (click)="eliminar(r)"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              }
            </div>
          </li>
        } @empty {
          <li class="vacio">Aún no hay rutas: todos los ítems recorren todos los procesos.</li>
        }
      </ul>
    } @else {
      <mat-progress-bar mode="indeterminate" aria-label="Cargando rutas" />
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .volver {
      margin: -8px 0 8px -12px;
    }
    .cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;

      button {
        min-height: 48px;
      }
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }
    .espacio {
      flex: 1;
    }
    .ayuda {
      margin: 8px 0 16px;
      color: var(--mat-sys-on-surface-variant);
    }
    .rutas {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;

      > li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: var(--mat-sys-corner-large);
      }
      > li.inactiva {
        color: var(--mat-sys-on-surface-variant);
      }
    }
    .datos {
      display: flex;
      flex: 1 1 320px;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .pasos {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 4px 0 0;
      padding: 0;
      list-style: none;

      li {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: var(--mat-sys-corner-full);
        background-color: var(--mat-sys-surface-container-high);
        font: var(--mat-sys-label-large);
      }
      li:not(:last-child)::after {
        content: '→';
        margin-left: 6px;
        color: var(--mat-sys-on-surface-variant);
      }
      li.final {
        background-color: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }
    }
    .punto {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: var(--mat-sys-outline);
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;

      button {
        min-height: 48px;
      }
    }
    .etiqueta {
      padding: 2px 10px;
      border-radius: var(--mat-sys-corner-full);
      background-color: var(--mat-sys-surface-container-high);
      font: var(--mat-sys-label-medium);
    }
    .secundario,
    .vacio {
      color: var(--mat-sys-on-surface-variant);
    }
    .mensaje-error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 8px 8px 16px;
      border-radius: var(--mat-sys-corner-medium);
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class RutasProduccion {
  private readonly api = inject(Api);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);

  protected readonly puedeGestionar = inject(Sesion).tienePermiso(PERMISOS.gestionarProduccion);
  protected readonly rutas = resource({
    loader: () =>
      this.api.invoke(rutaProduccionListar, {}, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly procesos = resource({
    loader: () =>
      this.api.invoke(rutaProduccionProcesos, {}, new HttpContext().set(MANEJA_ERRORES, true)),
  });
  protected readonly error = computed(() =>
    this.rutas.error() ? leerProblema(this.rutas.error()).mensaje : null,
  );
  protected readonly ocupado = signal(false);

  protected editar(ruta?: RutaProduccionDto): void {
    this.dialogos
      .open<FormularioRuta, DatosRuta, RutaProduccionDto>(FormularioRuta, {
        data: { ruta, procesos: this.procesos.value()?.procesos ?? [] },
        width: '560px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((guardada) => {
        if (guardada) {
          this.rutas.reload();
          this.avisos.exito(`Ruta ${guardada.nombre} guardada.`);
        }
      });
  }

  protected items(ruta: RutaProduccionDto): void {
    this.dialogos
      .open<ItemsRuta, RutaProduccionDto, boolean>(ItemsRuta, {
        data: ruta,
        width: '560px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((cambio) => {
        if (cambio) {
          this.rutas.reload();
        }
      });
  }

  protected async eliminar(ruta: RutaProduccionDto): Promise<void> {
    const confirmado = await firstValueFrom(
      this.dialogos
        .open<Confirmacion, DatosConfirmacion, boolean>(Confirmacion, {
          data: {
            titulo: `Eliminar ${ruta.nombre}`,
            mensaje:
              'Sus ítems pasan a recorrer todos los procesos. Si alguna orden la usó, desactívela en su lugar.',
            accion: 'Eliminar',
          },
        })
        .afterClosed(),
    );
    if (!confirmado) {
      return;
    }
    try {
      await this.api.invoke(
        rutaProduccionEliminar,
        { id: ruta.id ?? 0 },
        new HttpContext().set(MANEJA_ERRORES, true),
      );
      this.rutas.reload();
      this.avisos.exito(`Ruta ${ruta.nombre} eliminada.`);
    } catch (e) {
      this.avisos.error(leerProblema(e).mensaje);
    }
  }
}
