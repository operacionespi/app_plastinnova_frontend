import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Api } from '../../api/api';
import { ordenProduccionAvanzar } from '../../api/fn/ordenes-de-produccion/orden-produccion-avanzar';
import { OrdenProduccionDto } from '../../api/models/orden-produccion-dto';
import { AvanzarOrden } from './avanzar-orden';

const ORDEN: OrdenProduccionDto = {
  id: 3,
  numero: 'OP-000003',
  itemCodigo: 'IT-PT1',
  cantidad: 10,
  cantidadMaximaReportable: 9,
  etapa: { id: 5, codigo: 'CALIDAD', nombre: 'Calidad' },
  etapasSiguientes: [{ id: 6, codigo: 'ALMACEN1', nombre: 'Almacén 1' }],
  etapaRecepcion: 'ALMACEN1',
  bodegaDestino: '1A001',
  componentes: [
    { codigo: 'LAM/IT', unidad: 'Und', bodega: '1A001', cantidadPorUnidad: 2, libre: 20 },
    { codigo: 'RESINA-IT', unidad: 'Kg', bodega: '1A013', cantidadPorUnidad: 0.5, libre: 3 },
  ],
  lineas: [],
};

describe('AvanzarOrden', () => {
  const dialogo = { close: vi.fn() };
  let avanzar: ReturnType<typeof vi.fn<(params: unknown) => Promise<unknown>>>;
  let fixture: ComponentFixture<AvanzarOrden>;

  beforeEach(async () => {
    avanzar = vi.fn().mockResolvedValue({ ...ORDEN, estado: 'TERMINADA' });
    TestBed.configureTestingModule({
      imports: [AvanzarOrden],
      providers: [
        {
          provide: Api,
          useValue: {
            invoke: vi.fn((fn: unknown, params: unknown) =>
              fn === ordenProduccionAvanzar
                ? avanzar(params)
                : Promise.reject(new Error('inesperado')),
            ),
          },
        },
        { provide: MAT_DIALOG_DATA, useValue: ORDEN },
        { provide: MatDialogRef, useValue: dialogo },
      ],
    });
    fixture = TestBed.createComponent(AvanzarOrden);
    await fixture.whenStable();
  });

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('al llegar a la bodega muestra lo que consume y qué no alcanza', () => {
    // Única etapa siguiente: queda elegida; 9 piezas piden 18 láminas y 4.5 kg de resina
    expect(texto()).toContain('Las piezas entran a 1A001 y la orden termina');
    const faltantes = [...fixture.nativeElement.querySelectorAll('li.falta')].map((li) =>
      (li as HTMLElement).textContent?.trim(),
    );
    expect(faltantes).toHaveLength(1);
    expect(faltantes[0]).toContain('RESINA-IT');
  });

  it('reporta la etapa y las piezas', async () => {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
    expect(avanzar).toHaveBeenCalledWith({
      id: 3,
      body: { etapaId: 6, cantidad: 9, observaciones: undefined },
    });
    expect(dialogo.close).toHaveBeenCalled();
  });
});
