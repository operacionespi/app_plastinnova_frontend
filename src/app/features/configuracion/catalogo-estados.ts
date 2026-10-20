import { HttpContext } from '@angular/common/http';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../api/api';
import { EstadoCatalogoResponseDto } from '../../api/models/estado-catalogo-response-dto';
import { TransicionResponseDto } from '../../api/models/transicion-response-dto';
import { MANEJA_ERRORES } from '../../core/http/contexto';
import { leerProblema } from '../../core/http/problema';
import { Avisos } from '../../core/ui/avisos';
import { Confirmacion, DatosConfirmacion } from '../../core/ui/confirmacion';
import { API_ESTADOS, TipoCatalogo } from './api-estados';
import { DatosFormularioEstado, FormularioEstado } from './formulario-estado';
import { DatosNuevaTransicion, NuevaTransicion } from './nueva-transicion';

/** Estados de un catálogo (pedido o línea) y las transiciones permitidas entre ellos. */
@Component({
  selector: 'pi-catalogo-estados',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './catalogo-estados.html',
  styleUrl: './catalogo-estados.scss',
})
export class CatalogoEstados {
  private readonly api = inject(Api);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(Avisos);

  readonly tipo = input.required<TipoCatalogo>();
  protected readonly incluirInactivos = signal(false);

  protected readonly estados = resource({
    params: () => ({ tipo: this.tipo(), incluirInactivos: this.incluirInactivos() }),
    loader: ({ params }) =>
      this.api.invoke(
        API_ESTADOS[params.tipo].listar,
        { incluirInactivos: params.incluirInactivos },
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly transiciones = resource({
    params: () => ({ tipo: this.tipo() }),
    loader: ({ params }) =>
      this.api.invoke(
        API_ESTADOS[params.tipo].listarTransiciones,
        {},
        new HttpContext().set(MANEJA_ERRORES, true),
      ),
  });
  protected readonly error = computed(() => {
    const e = this.estados.error() ?? this.transiciones.error();
    return e ? leerProblema(e).mensaje : null;
  });

  protected readonly activos = computed(() =>
    (this.estados.value() ?? []).filter((e) => e.activo !== false),
  );

  /** Cada estado activo con los destinos a los que puede pasar. */
  protected readonly flujo = computed(() => {
    const transiciones = this.transiciones.value() ?? [];
    return this.activos().map((estado) => ({
      estado,
      salidas: transiciones
        .filter((t) => t.estadoOrigen?.id === estado.id)
        .sort((a, b) => (a.estadoDestino?.ordenLogico ?? 0) - (b.estadoDestino?.ordenLogico ?? 0)),
    }));
  });

  protected readonly columnas = ['orden', 'nombre', 'codigo', 'tipo', 'activo', 'acciones'];

  protected nombreCatalogo(): string {
    return this.tipo() === 'pedido' ? 'pedido' : 'línea';
  }

  protected crear(): void {
    const ordenes = (this.estados.value() ?? []).map((e) => e.ordenLogico ?? 0);
    this.editar(undefined, (ordenes.length ? Math.max(...ordenes) : 0) + 10);
  }

  protected editar(estado?: EstadoCatalogoResponseDto, siguienteOrden = 0): void {
    this.dialogos
      .open<FormularioEstado, DatosFormularioEstado, EstadoCatalogoResponseDto>(FormularioEstado, {
        data: { tipo: this.tipo(), estado, siguienteOrden },
        width: '640px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((guardado) => {
        if (guardado) {
          this.avisos.exito(`Estado ${guardado.nombre} guardado.`);
          this.recargar();
        }
      });
  }

  protected async activar(estado: EstadoCatalogoResponseDto): Promise<void> {
    await this.ejecutar(async () => {
      await this.api.invoke(
        API_ESTADOS[this.tipo()].activar,
        { id: estado.id ?? 0 },
        this.contexto(),
      );
      this.avisos.exito(`Estado ${estado.nombre} activado.`);
    });
  }

  protected async eliminar(estado: EstadoCatalogoResponseDto): Promise<void> {
    const confirmado = await this.confirmar({
      titulo: `Eliminar ${estado.nombre}`,
      mensaje:
        'Se eliminan también sus transiciones. Si el estado ya se usó en pedidos o en el historial, ' +
        'se desactiva en lugar de eliminarse (deja de ofrecerse, pero se conserva lo registrado).',
      accion: 'Eliminar',
    });
    if (confirmado) {
      await this.ejecutar(async () => {
        const resultado = await this.api.invoke(
          API_ESTADOS[this.tipo()].eliminar,
          { id: estado.id ?? 0 },
          this.contexto(),
        );
        this.avisos.exito(resultado.mensaje ?? 'Estado eliminado.');
      });
    }
  }

  protected agregarTransicion(origen?: EstadoCatalogoResponseDto): void {
    this.dialogos
      .open<NuevaTransicion, DatosNuevaTransicion, TransicionResponseDto>(NuevaTransicion, {
        data: {
          tipo: this.tipo(),
          estados: this.activos(),
          transiciones: this.transiciones.value() ?? [],
          origenId: origen?.id,
        },
        width: '480px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((creada) => {
        if (creada) {
          this.avisos.exito(
            `Transición ${creada.estadoOrigen?.nombre} → ${creada.estadoDestino?.nombre} agregada.`,
          );
          this.transiciones.reload();
        }
      });
  }

  protected async quitarTransicion(t: TransicionResponseDto): Promise<void> {
    const confirmado = await this.confirmar({
      titulo: 'Quitar transición',
      mensaje: `Ya no se podrá pasar de ${t.estadoOrigen?.nombre} a ${t.estadoDestino?.nombre}.`,
      accion: 'Quitar',
    });
    if (confirmado) {
      await this.ejecutar(async () => {
        await this.api.invoke(
          API_ESTADOS[this.tipo()].eliminarTransicion,
          { id: t.id ?? 0 },
          this.contexto(),
        );
        this.avisos.exito('Transición quitada.');
      });
    }
  }

  private recargar(): void {
    this.estados.reload();
    this.transiciones.reload();
  }

  private contexto(): HttpContext {
    return new HttpContext().set(MANEJA_ERRORES, true);
  }

  /** Errores de negocio (409) como aviso; siempre recarga para reflejar el estado real. */
  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    try {
      await accion();
    } catch (e) {
      this.avisos.error(leerProblema(e).mensaje);
    }
    this.recargar();
  }

  private confirmar(datos: DatosConfirmacion): Promise<boolean | undefined> {
    return firstValueFrom(
      this.dialogos
        .open<Confirmacion, DatosConfirmacion, boolean>(Confirmacion, {
          data: datos,
          width: '440px',
        })
        .afterClosed(),
    );
  }
}
