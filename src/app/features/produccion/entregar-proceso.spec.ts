import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Api } from '../../api/api';
import { ordenProduccionEntregar } from '../../api/fn/ordenes-de-produccion/orden-produccion-entregar';
import { OrdenProduccionDto } from '../../api/models/orden-produccion-dto';
import { ProductoOrdenDto } from '../../api/models/producto-orden-dto';
import { DatosEntrega, EntregarProceso } from './entregar-proceso';

const ENSAMBLE = { id: 3, codigo: 'EN_ENSAMBLE', nombre: 'En ensamble' };
const RESINA = { id: 4, codigo: 'RESINA', nombre: 'Resina' };
const CALIDAD = { id: 5, codigo: 'CALIDAD', nombre: 'Calidad' };
const ALMACEN = { id: 6, codigo: 'ALMACEN1', nombre: 'Almacén 1' };

const PRODUCTO: ProductoOrdenDto = {
  id: 7,
  itemCodigo: 'IT-PT1',
  bodegaDestino: '1A001',
  etapas: [
    { etapa: ENSAMBLE, cantidad: 3 },
    { etapa: RESINA, cantidad: 0 },
    { etapa: CALIDAD, cantidad: 9 },
  ],
  componentes: [
    { codigo: 'LAM/IT', unidad: 'Und', bodega: '1A001', cantidadPorUnidad: 2, libre: 20 },
    { codigo: 'RESINA-IT', unidad: 'Kg', bodega: '1A013', cantidadPorUnidad: 0.5, libre: 3 },
  ],
  lineas: [],
};
const ORDEN: OrdenProduccionDto = {
  id: 3,
  numero: 'OP-000003',
  etapaRecepcion: ALMACEN,
  productos: [PRODUCTO],
};

describe('EntregarProceso', () => {
  const dialogo = { close: vi.fn() };
  let entregar: ReturnType<typeof vi.fn<(params: unknown) => Promise<unknown>>>;
  let fixture: ComponentFixture<EntregarProceso>;

  async function crear(datos: DatosEntrega): Promise<void> {
    entregar = vi.fn().mockResolvedValue(ORDEN);
    TestBed.configureTestingModule({
      imports: [EntregarProceso],
      providers: [
        {
          provide: Api,
          useValue: {
            invoke: vi.fn((fn: unknown, params: unknown) =>
              fn === ordenProduccionEntregar
                ? entregar(params)
                : Promise.reject(new Error('inesperado')),
            ),
          },
        },
        { provide: MAT_DIALOG_DATA, useValue: datos },
        { provide: MatDialogRef, useValue: dialogo },
      ],
    });
    fixture = TestBed.createComponent(EntregarProceso);
    await fixture.whenStable();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const enviar = async () => {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
  };

  it('desde el último proceso entrega al almacén y muestra lo que no alcanza', async () => {
    await crear({ orden: ORDEN, producto: PRODUCTO });
    // Por defecto: el proceso más avanzado con piezas (Calidad, 9) y su siguiente (Almacén 1)
    expect(texto()).toContain('Las piezas entran a 1A001');
    const faltantes = [...fixture.nativeElement.querySelectorAll('li.falta')].map(
      (li) => (li as HTMLElement).textContent ?? '',
    );
    expect(faltantes).toHaveLength(1);
    expect(faltantes[0]).toContain('RESINA-IT');

    await enviar();
    expect(entregar).toHaveBeenCalledWith({
      id: 3,
      body: {
        productoId: 7,
        etapaOrigenId: 5,
        etapaDestinoId: 6,
        cantidad: 9,
        observaciones: undefined,
      },
    });
    expect(dialogo.close).toHaveBeenCalled();
  });

  it('una devolución exige el motivo', async () => {
    await crear({ orden: ORDEN, producto: PRODUCTO, origenId: 5 });
    const devolver = [...fixture.nativeElement.querySelectorAll('mat-button-toggle')].find((b) =>
      (b as HTMLElement).textContent?.includes('En ensamble'),
    ) as HTMLElement;
    // El primer grupo es el origen; el segundo, el destino (Almacén 1, luego Resina y Ensamble como devolución)
    const destinos = fixture.nativeElement.querySelectorAll(
      'mat-button-toggle-group',
    )[1] as HTMLElement;
    expect(destinos.textContent).toContain('Almacén 1');
    expect(destinos.textContent).toContain('Resina');
    expect(devolver).toBeTruthy();
    (destinos.querySelectorAll('button')[2] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(texto()).toContain('indique el motivo del rechazo');

    await enviar();
    expect(entregar).not.toHaveBeenCalled();
  });
});
