import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Api } from '../../api/api';
import { LineaColaDto } from '../../api/models/linea-cola-dto';
import { CorregirCantidad } from './corregir-cantidad';

describe('CorregirCantidad', () => {
  const linea: LineaColaDto = {
    id: 7,
    numeroPedido: '20451',
    posicion: 2,
    cantidadSolicitada: 10,
    cantidadProcesada: 8,
    avanceReportado: true,
    estadoActual: { id: 4, nombre: 'Resina' },
  };
  const dialogo = { close: vi.fn() };
  const invoke = vi.fn<(fn: unknown, params: unknown) => Promise<unknown>>();
  let fixture: ComponentFixture<CorregirCantidad>;

  beforeEach(async () => {
    dialogo.close.mockReset();
    invoke.mockReset();
    TestBed.configureTestingModule({
      imports: [CorregirCantidad],
      providers: [
        { provide: Api, useValue: { invoke } },
        { provide: MAT_DIALOG_DATA, useValue: linea },
        { provide: MatDialogRef, useValue: dialogo },
      ],
    });
    fixture = TestBed.createComponent(CorregirCantidad);
    await fixture.whenStable();
  });

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const escribir = (selector: string, valor: string) => {
    const campo = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('exige otra cantidad y una justificación', async () => {
    await enviar();
    expect(invoke).not.toHaveBeenCalled();
    expect(texto()).toContain('Es la misma cantidad que ya está reportada.');
    expect(texto()).toContain('Explique por qué se corrige.');

    escribir('input[type=number]', '11');
    escribir('textarea', 'corto');
    await enviar();
    expect(texto()).toContain('No puede superar 10.');
    expect(texto()).toContain('Escriba al menos 10 caracteres.');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('envía la corrección y devuelve la línea actualizada', async () => {
    invoke.mockResolvedValue({ id: 7, cantidadProcesada: 10 });
    escribir('input[type=number]', '10');
    escribir('textarea', '  Dos piezas quedaron sin contar  ');
    await enviar();
    expect(invoke).toHaveBeenCalledWith(
      expect.anything(),
      { id: 7, body: { cantidadProcesada: 10, justificacion: 'Dos piezas quedaron sin contar' } },
      expect.anything(),
    );
    expect(dialogo.close).toHaveBeenCalledWith({ id: 7, cantidadProcesada: 10 });
  });

  it('muestra el error del backend sin cerrar', async () => {
    invoke.mockRejectedValue(
      new HttpErrorResponse({ status: 403, error: { detail: 'Acceso denegado.' } }),
    );
    escribir('input[type=number]', '9');
    escribir('textarea', 'Justificación suficiente');
    await enviar();
    expect(dialogo.close).not.toHaveBeenCalled();
    expect(texto()).toContain('Acceso denegado.');
  });
});
