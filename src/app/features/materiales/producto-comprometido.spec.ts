import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Api } from '../../api/api';
import { reservaInventarioComprometer } from '../../api/fn/reservas-de-inventario/reserva-inventario-comprometer';
import { reservaInventarioReservasPedido } from '../../api/fn/reservas-de-inventario/reserva-inventario-reservas-pedido';
import { ReservasPedidoDto } from '../../api/models/reservas-pedido-dto';
import { Sesion } from '../../core/auth/sesion';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { ProductoComprometido } from './producto-comprometido';

const SIN_COMPROMETER: ReservasPedidoDto = {
  pedidoId: 9,
  numeroPedido: '20451',
  bodega: '1A001',
  estado: 'SIN_COMPROMETER',
  lineas: [
    {
      detalleId: 1,
      posicion: 1,
      productoSku: '0111/AH/MULTI',
      itemCodigo: '0111/AH/MULTI',
      descripcion: '0111 Lat Ah',
      unidad: 'Und',
      estadoLinea: 'Creado',
      cantidadSolicitada: 10,
      reservada: 0,
      existencia: 6,
      libre: 6,
      maximoReservable: 6,
      reservable: true,
    },
    {
      detalleId: 2,
      posicion: 2,
      productoSku: 'SIN-ITEM',
      descripcion: 'Sin ítem',
      estadoLinea: 'Creado',
      cantidadSolicitada: 3,
      reservada: 0,
      existencia: 0,
      libre: 0,
      maximoReservable: 0,
      reservable: false,
      motivoNoReservable: 'El producto no está en el maestro de ítems.',
    },
  ],
};

const PARCIAL: ReservasPedidoDto = {
  ...SIN_COMPROMETER,
  estado: 'PARCIAL',
  lineas: [
    { ...SIN_COMPROMETER.lineas![0], reservada: 6, libre: 0, maximoReservable: 6 },
    SIN_COMPROMETER.lineas![1],
  ],
};

describe('ProductoComprometido', () => {
  let fixture: ComponentFixture<ProductoComprometido>;
  let invocadas: unknown[];
  let cambios: number;

  async function crear(permisos: string[]): Promise<void> {
    invocadas = [];
    cambios = 0;
    const api = {
      invoke: vi.fn((fn: unknown) => {
        invocadas.push(fn);
        if (fn === reservaInventarioReservasPedido) return Promise.resolve(SIN_COMPROMETER);
        if (fn === reservaInventarioComprometer) return Promise.resolve(PARCIAL);
        return Promise.reject(new Error('inesperado'));
      }),
    };
    TestBed.configureTestingModule({
      imports: [ProductoComprometido],
      providers: [
        { provide: Api, useValue: api },
        { provide: Sesion, useValue: { tienePermiso: (p: string) => permisos.includes(p) } },
      ],
    });
    fixture = TestBed.createComponent(ProductoComprometido);
    fixture.componentRef.setInput('pedidoId', 9);
    fixture.componentInstance.cambio.subscribe(() => cambios++);
    await fixture.whenStable();
  }

  const elemento = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    [...elemento().querySelectorAll('button')].find((b) => b.textContent?.includes(texto));

  it('muestra lo libre por línea y explica por qué una línea no puede reservar', async () => {
    await crear([PERMISOS.reservarInventario]);
    const texto = elemento().textContent ?? '';
    expect(texto).toContain('Sin comprometer');
    expect(texto).toContain('0111 Lat Ah');
    expect(
      elemento().querySelector('[aria-label="El producto no está en el maestro de ítems."]'),
    ).not.toBeNull();
    expect(boton('Liberar')).toBeUndefined();
  });

  it('comprometer actualiza la tabla y avisa que cambiaron los materiales', async () => {
    await crear([PERMISOS.reservarInventario]);
    boton('Comprometer')!.click();
    await fixture.whenStable();

    expect(invocadas).toContain(reservaInventarioComprometer);
    expect(cambios).toBe(1);
    expect(elemento().textContent).toContain('Comprometido en parte');
    expect(boton('Liberar')).toBeDefined();
  });

  it('sin permiso para reservar solo consulta', async () => {
    await crear([PERMISOS.verInventario]);
    expect(boton('Comprometer')).toBeUndefined();
    expect(elemento().querySelector('button[aria-label^="Cambiar"]')).toBeNull();
  });
});
