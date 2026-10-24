import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Api } from '../../api/api';
import { inventarioBodegas } from '../../api/fn/inventario/inventario-bodegas';
import { inventarioRegistrar } from '../../api/fn/inventario/inventario-registrar';
import { inventarioSlots } from '../../api/fn/inventario/inventario-slots';
import { DatosMovimiento, RegistrarMovimiento } from './registrar-movimiento';

describe('RegistrarMovimiento', () => {
  let fixture: ComponentFixture<RegistrarMovimiento>;
  let registrados: unknown[];
  let cerrar: ReturnType<typeof vi.fn>;
  let respuesta: () => Promise<unknown>;

  async function abrir(datos: DatosMovimiento): Promise<void> {
    registrados = [];
    cerrar = vi.fn();
    respuesta = () => Promise.resolve({ id: 1, tipo: 'TRASLADO' });
    const api = {
      invoke: vi.fn((fn: unknown, params: { body: unknown }) => {
        if (fn === inventarioBodegas)
          return Promise.resolve([{ id: 1, codigo: '1A001', descripcion: 'PT' }]);
        if (fn === inventarioSlots)
          return Promise.resolve([
            { id: 10, bodegaId: 1, codigo: 'A-01', activo: true },
            { id: 11, bodegaId: 1, codigo: 'A-02', activo: true },
          ]);
        if (fn === inventarioRegistrar) {
          registrados.push(params.body);
          return respuesta();
        }
        return Promise.reject(new Error('inesperado'));
      }),
    };
    TestBed.configureTestingModule({
      imports: [RegistrarMovimiento],
      providers: [
        { provide: Api, useValue: api },
        { provide: MAT_DIALOG_DATA, useValue: datos },
        { provide: MatDialogRef, useValue: { close: cerrar } },
      ],
    });
    fixture = TestBed.createComponent(RegistrarMovimiento);
    await fixture.whenStable();
  }

  const elemento = () => fixture.nativeElement as HTMLElement;

  async function escribirCantidad(valor: string): Promise<void> {
    const cantidad = elemento().querySelector('input[type=number]') as HTMLInputElement;
    cantidad.value = valor;
    cantidad.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function enviar(): Promise<void> {
    elemento().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('desde una fila de existencias el slot es el origen del traslado y exige el destino', async () => {
    await abrir({ tipo: 'TRASLADO', itemCodigo: 'LAM/IT', slotId: 10, saldo: 7, unidad: 'Und' });
    expect(elemento().textContent).toContain('Saldo actual: 7 Und');
    await escribirCantidad('3');

    await enviar();
    expect(registrados).toEqual([]);
    expect(elemento().textContent).toContain('Elija el slot de origen y el de destino.');

    fixture.componentInstance['destino'].set(11);
    await enviar();
    expect(registrados).toEqual([
      {
        tipo: 'TRASLADO',
        itemCodigo: 'LAM/IT',
        cantidad: 3,
        slotOrigenId: 10,
        slotDestinoId: 11,
        motivo: undefined,
        observaciones: undefined,
      },
    ]);
    expect(cerrar).toHaveBeenCalledWith({ id: 1, tipo: 'TRASLADO' });
  });

  it('al pasar a ajuste el slot elegido es el contado y se envía como destino', async () => {
    await abrir({ tipo: 'SALIDA', itemCodigo: 'LAM/IT', slotId: 10 });
    const ajuste = [...elemento().querySelectorAll('mat-button-toggle button')].find((b) =>
      b.textContent?.includes('Ajuste'),
    ) as HTMLButtonElement;
    ajuste.click();
    await fixture.whenStable();
    expect(elemento().textContent).toContain('Cantidad contada');
    await escribirCantidad('0');

    await enviar();
    expect(registrados).toEqual([
      expect.objectContaining({
        tipo: 'AJUSTE',
        cantidad: 0,
        slotOrigenId: undefined,
        slotDestinoId: 10,
      }),
    ]);
  });

  it('muestra el error del servidor y no cierra', async () => {
    await abrir({ tipo: 'SALIDA', itemCodigo: 'LAM/IT', slotId: 10 });
    respuesta = () =>
      Promise.reject(
        new HttpErrorResponse({
          status: 409,
          error: { detail: 'No hay suficiente LAM/IT en 1A001 / A-01: hay 2.' },
        }),
      );
    await escribirCantidad('5');
    await enviar();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('No hay suficiente LAM/IT');
    expect(cerrar).not.toHaveBeenCalled();
  });
});
