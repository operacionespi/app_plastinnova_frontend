import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../../api/api';
import { remisionEmitir } from '../../api/fn/entregas/remision-emitir';
import { remisionEntregasPedido } from '../../api/fn/entregas/remision-entregas-pedido';
import { EntregasPedidoDto } from '../../api/models/entregas-pedido-dto';
import { Sesion } from '../../core/auth/sesion';
import { PERMISOS } from '../../core/navegacion/navegacion';
import { EntregasPedido } from './entregas-pedido';

const ENTREGAS: EntregasPedidoDto = {
  pedidoId: 9,
  numeroPedido: '20451',
  cliente: 'Cliente IT',
  bodega: '1A001',
  lineas: [
    {
      detalleId: 1,
      posicion: 1,
      productoSku: '0111/AH/MULTI',
      descripcion: '0111 Lat Ah',
      estadoLinea: { id: 6, nombre: 'Almacén 1' },
      cantidadSolicitada: 10,
      cantidadEntregada: 4,
      cantidadPorEntregar: 6,
      reservada: 5,
      libre: 0,
      maximoEntregable: 5,
      sinInventario: false,
    },
    {
      detalleId: 2,
      posicion: 2,
      productoSku: 'TQ-500',
      descripcion: 'Tanque',
      estadoLinea: { id: 7, nombre: 'Entregado' },
      cantidadSolicitada: 3,
      cantidadEntregada: 3,
      cantidadPorEntregar: 0,
      maximoEntregable: 0,
      sinInventario: false,
      motivoNoEntregable: 'La línea ya se entregó completa.',
    },
  ],
  remisiones: [],
};

describe('EntregasPedido', () => {
  let fixture: ComponentFixture<EntregasPedido>;
  let emitir: ReturnType<typeof vi.fn<(params: unknown) => Promise<unknown>>>;

  async function crear(permisos: string[]): Promise<void> {
    emitir = vi.fn().mockResolvedValue({ numero: 'REM-000001', totalPiezas: 5 });
    const api = {
      invoke: vi.fn((fn: unknown, params: unknown) =>
        fn === remisionEntregasPedido
          ? Promise.resolve(ENTREGAS)
          : fn === remisionEmitir
            ? emitir(params)
            : Promise.reject(new Error('inesperado')),
      ),
    };
    TestBed.configureTestingModule({
      imports: [EntregasPedido],
      providers: [
        provideRouter([]),
        { provide: Api, useValue: api },
        { provide: Sesion, useValue: { tienePermiso: (p: string) => permisos.includes(p) } },
      ],
    });
    fixture = TestBed.createComponent(EntregasPedido);
    fixture.componentRef.setInput('id', '9');
    await fixture.whenStable();
  }

  const elemento = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    [...elemento().querySelectorAll('button')].find((b) => b.textContent?.includes(texto));

  it('entrega todo lo disponible de las líneas pendientes', async () => {
    await crear([PERMISOS.verEntregas, PERMISOS.gestionarEntregas]);
    expect(elemento().textContent).toContain('La línea ya se entregó completa.');
    expect(boton('Emitir remisión')!.disabled).toBe(true);

    boton('Entregar todo lo disponible')!.click();
    await fixture.whenStable();
    boton('Emitir remisión')!.click();
    await fixture.whenStable();

    expect(emitir).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        body: expect.objectContaining({ lineas: [{ detalleId: 1, cantidad: 5 }] }),
      }),
    );
  });

  it('no deja pasar de lo disponible', async () => {
    await crear([PERMISOS.verEntregas, PERMISOS.gestionarEntregas]);
    const input = elemento().querySelector('input[type=number]') as HTMLInputElement;
    input.value = '6';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    boton('Emitir remisión')!.click();
    await fixture.whenStable();

    expect(emitir).not.toHaveBeenCalled();
    expect(elemento().querySelector('[role=alert]')?.textContent).toContain(
      'puede entregar hasta 5 piezas',
    );
  });

  it('sin permiso para entregar solo consulta', async () => {
    await crear([PERMISOS.verEntregas]);
    expect(elemento().querySelector('input[type=number]')).toBeNull();
    expect(boton('Emitir remisión')).toBeUndefined();
  });
});
