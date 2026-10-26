import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Api } from '../../api/api';
import { estadosDetalleDestinos } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-destinos';
import { pedidoDetalleCambiarEstadoDetalle } from '../../api/fn/lineas-de-pedido/pedido-detalle-cambiar-estado-detalle';
import { LineaColaDto } from '../../api/models/linea-cola-dto';
import { ReportarAvance } from './reportar-avance';

describe('ReportarAvance', () => {
  const linea: LineaColaDto = {
    id: 7,
    numeroPedido: '20451',
    posicion: 2,
    productoSku: 'TQ-500',
    productoNombre: 'Tanque 500 L',
    cantidadSolicitada: 10,
    cantidadProcesada: 0,
    estadoActual: { id: 3, nombre: 'En ensamble' },
  };
  const dialogo = { close: vi.fn() };
  let destinos: { id: number; nombre: string; esFinal?: boolean }[];
  let cambiar: ReturnType<typeof vi.fn<(params: unknown) => Promise<unknown>>>;
  let fixture: ComponentFixture<ReportarAvance>;

  async function crear(): Promise<void> {
    cambiar = vi.fn().mockResolvedValue({ id: 7, estadoActual: { nombre: 'Resina' } });
    const api = {
      invoke: vi.fn((fn: unknown, params: unknown) =>
        fn === estadosDetalleDestinos
          ? Promise.resolve(destinos)
          : fn === pedidoDetalleCambiarEstadoDetalle
            ? cambiar(params)
            : Promise.reject(new Error('inesperado')),
      ),
    };
    TestBed.configureTestingModule({
      imports: [ReportarAvance],
      providers: [
        { provide: Api, useValue: api },
        { provide: MAT_DIALOG_DATA, useValue: linea },
        { provide: MatDialogRef, useValue: dialogo },
      ],
    });
    fixture = TestBed.createComponent(ReportarAvance);
    await fixture.whenStable();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const cantidad = (valor: string) => {
    const input = fixture.nativeElement.querySelector('input[type=number]') as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
  };
  const botonDestino = (nombre: string) =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('mat-button-toggle button')].find(
      (b) => b.textContent?.includes(nombre),
    ) as HTMLButtonElement;

  beforeEach(() => dialogo.close.mockReset());

  it('con un solo destino lo elige y reporta la línea completa por defecto', async () => {
    destinos = [{ id: 4, nombre: 'Resina' }];
    await crear();
    await enviar();
    expect(cambiar).toHaveBeenCalledWith({
      id: 7,
      body: { nuevoEstadoId: 4, cantidadProcesada: 10, observaciones: undefined },
    });
    expect(dialogo.close).toHaveBeenCalledWith({ id: 7, estadoActual: { nombre: 'Resina' } });
  });

  it('con varios destinos exige elegir uno y valida la cantidad', async () => {
    destinos = [
      { id: 4, nombre: 'Resina' },
      { id: 5, nombre: 'Calidad' },
    ];
    await crear();
    cantidad('11');
    await enviar();
    expect(cambiar).not.toHaveBeenCalled();
    expect(texto()).toContain('Elija la etapa a la que pasa la línea.');
    expect(texto()).toContain('No puede superar 10.');

    botonDestino('Calidad').click();
    cantidad('6');
    await enviar();
    expect(cambiar).toHaveBeenCalledWith({
      id: 7,
      body: { nuevoEstadoId: 5, cantidadProcesada: 6, observaciones: undefined },
    });
  });

  it('muestra el conflicto del backend sin cerrar', async () => {
    destinos = [{ id: 4, nombre: 'Resina' }];
    await crear();
    cambiar.mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        error: { detail: 'La línea fue modificada por otro usuario.' },
      }),
    );
    await enviar();
    fixture.detectChanges();
    expect(dialogo.close).not.toHaveBeenCalled();
    expect(texto()).toContain('La línea fue modificada por otro usuario.');
    expect(texto()).toContain('Cierre esta ventana para ver la línea actualizada.');
  });

  it('no deja reportar más piezas de las que reportó la etapa anterior', async () => {
    destinos = [{ id: 4, nombre: 'Resina' }];
    Object.assign(linea, { cantidadProcesada: 8, cantidadMaximaReporte: 8, avanceReportado: true });
    try {
      await crear();
      expect(texto()).toContain('La etapa anterior reportó 8 de 10 piezas.');
      // Por defecto pasan las 8 que llegaron
      expect(
        (fixture.nativeElement.querySelector('input[type=number]') as HTMLInputElement).value,
      ).toBe('8');
      cantidad('9');
      await enviar();
      fixture.detectChanges();
      expect(cambiar).not.toHaveBeenCalled();
      expect(texto()).toContain('No puede superar 8: es lo que reportó la etapa anterior.');
    } finally {
      Object.assign(linea, {
        cantidadProcesada: 0,
        cantidadMaximaReporte: undefined,
        avanceReportado: false,
      });
    }
  });

  it('no ofrece Entregado: la línea se entrega con remisión', async () => {
    destinos = [{ id: 7, nombre: 'Entregado', esFinal: true }];
    await crear();
    expect(texto()).not.toContain('Entregado');
    expect(texto()).toContain('se registra con una remisión');
    const guardar = fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(guardar.disabled).toBe(true);
  });
});
