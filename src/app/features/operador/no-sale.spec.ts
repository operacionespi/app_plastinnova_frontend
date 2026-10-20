import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Api } from '../../api/api';
import { pedidoDetalleDevolverLinea } from '../../api/fn/lineas-de-pedido/pedido-detalle-devolver-linea';
import { pedidoDetalleMarcarNoSale } from '../../api/fn/lineas-de-pedido/pedido-detalle-marcar-no-sale';
import { LineaColaDto } from '../../api/models/linea-cola-dto';
import { DatosNoSale, mensajeNoSale, NoSale } from './no-sale';

describe('NoSale', () => {
  const linea: LineaColaDto = {
    id: 7,
    numeroPedido: '20451',
    posicion: 2,
    estadoActual: { id: 3, nombre: 'En ensamble' },
  };
  const dialogo = { close: vi.fn() };
  let invocar: ReturnType<typeof vi.fn<(fn: unknown, params: unknown) => Promise<unknown>>>;
  let fixture: ComponentFixture<NoSale>;

  async function crear(accion: DatosNoSale['accion']): Promise<void> {
    invocar = vi.fn().mockResolvedValue({ cambioEstadoPedido: false });
    TestBed.configureTestingModule({
      imports: [NoSale],
      providers: [
        { provide: Api, useValue: { invoke: invocar } },
        { provide: MAT_DIALOG_DATA, useValue: { linea, accion } },
        { provide: MatDialogRef, useValue: dialogo },
      ],
    });
    fixture = TestBed.createComponent(NoSale);
    await fixture.whenStable();
  }
  const escribir = (texto: string) => {
    const area = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    area.value = texto;
    area.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
  };
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => dialogo.close.mockReset());

  it('exige una justificación de al menos 10 caracteres', async () => {
    await crear('marcar');
    expect(texto()).toContain('el pedido quedará anulado');
    escribir('No hay');
    await enviar();
    expect(invocar).not.toHaveBeenCalled();
    expect(texto()).toContain('Escriba al menos 10 caracteres.');
  });

  it('marca la línea con la justificación sin espacios sobrantes', async () => {
    await crear('marcar');
    escribir('  Proveedor sin materia prima  ');
    await enviar();
    expect(invocar).toHaveBeenCalledWith(
      pedidoDetalleMarcarNoSale,
      { id: 7, body: { justificacion: 'Proveedor sin materia prima' } },
      expect.anything(),
    );
    expect(dialogo.close).toHaveBeenCalledWith({ cambioEstadoPedido: false });
  });

  it('devuelve la línea con su propio endpoint', async () => {
    await crear('devolver');
    escribir('Llegó el material del proveedor');
    await enviar();
    expect(invocar.mock.calls[0][0]).toBe(pedidoDetalleDevolverLinea);
  });

  it('avisa si el pedido se anuló o se reabrió', () => {
    const marcar: DatosNoSale = { linea, accion: 'marcar' };
    expect(mensajeNoSale(marcar, { cambioEstadoPedido: false })).toBe(
      'Pedido 20451, pos. 2: quedó en No sale.',
    );
    expect(
      mensajeNoSale(marcar, { cambioEstadoPedido: true, estadoPedido: { nombre: 'Anulado' } }),
    ).toBe(
      'Pedido 20451, pos. 2: quedó en No sale. El pedido quedó anulado: todas sus líneas están en No sale.',
    );
    expect(
      mensajeNoSale(
        { linea, accion: 'devolver' },
        {
          cambioEstadoPedido: true,
          linea: { estadoActual: { nombre: 'En ensamble' } },
          estadoPedido: { nombre: 'Creado' },
        },
      ),
    ).toBe('Pedido 20451, pos. 2: volvió a En ensamble. El pedido se reabrió en Creado.');
  });
});
