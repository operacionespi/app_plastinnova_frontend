import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../../api/api';
import { listaMaterialesMaterialesPedido } from '../../api/fn/lista-de-materiales/lista-materiales-materiales-pedido';
import { MaterialesPedidoDto } from '../../api/models/materiales-pedido-dto';
import { MaterialesPedido } from './materiales-pedido';

const MATERIALES: MaterialesPedidoDto = {
  pedidoId: 9,
  numeroPedido: '20451',
  fechaCarga: '2026-10-24T14:00:00',
  lineas: [
    {
      detalleId: 1,
      posicion: 1,
      productoSku: '0111/AH/MULTI',
      cantidad: 10,
      estructura: {
        codigo: '0111/AH/MULTI',
        descripcion: '0111 Lat Ah',
        tipo: 'PRODUCTO_TERMINADO',
        unidad: 'Und',
        enMaestro: true,
        cantidad: 10,
        componentes: [
          {
            codigo: 'LAM/0111/AH/MUL',
            descripcion: 'Lampara 0111',
            tipo: 'SEMITERMINADO',
            unidad: 'Und',
            enMaestro: true,
            bodega: '1A001',
            cantidadPorPadre: 1,
            cantidad: 10,
            componentes: [
              {
                codigo: 'POL/ABS',
                descripcion: 'Abs',
                tipo: 'MATERIA_PRIMA',
                unidad: 'Kg',
                enMaestro: true,
                bodega: '1A014',
                cantidadPorPadre: 0.0081,
                cantidad: 0.081,
                componentes: [],
              },
            ],
          },
        ],
      },
    },
    {
      detalleId: 2,
      posicion: 2,
      productoSku: 'SIN-LISTA',
      productoNombre: 'Sin lista',
      cantidad: 3,
    },
  ],
  totales: [
    {
      codigo: 'LAM/0111/AH/MUL',
      tipo: 'SEMITERMINADO',
      unidad: 'Und',
      enMaestro: true,
      bodega: '1A001',
      cantidad: 10,
      disponible: 4,
      faltante: 6,
      tieneComponentes: true,
    },
    {
      codigo: 'POL/ABS',
      tipo: 'MATERIA_PRIMA',
      unidad: 'Kg',
      enMaestro: true,
      bodega: '1A014',
      cantidad: 0.081,
      disponible: 5,
      faltante: 0,
      tieneComponentes: false,
    },
    {
      codigo: 'TORN-X',
      enMaestro: false,
      bodega: '1A004',
      cantidad: 30,
      disponible: 0,
      faltante: 30,
      tieneComponentes: false,
    },
  ],
};

describe('MaterialesPedido', () => {
  let fixture: ComponentFixture<MaterialesPedido>;
  let pedidos: unknown[];

  beforeEach(async () => {
    pedidos = [];
    const api = {
      invoke: vi.fn((fn: unknown, params: unknown) => {
        if (fn === listaMaterialesMaterialesPedido) {
          pedidos.push(params);
          return Promise.resolve(MATERIALES);
        }
        return Promise.reject(new Error('inesperado'));
      }),
    };
    TestBed.configureTestingModule({
      imports: [MaterialesPedido],
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
    fixture = TestBed.createComponent(MaterialesPedido);
    fixture.componentRef.setInput('id', '9');
    await fixture.whenStable();
  });

  const elemento = () => fixture.nativeElement as HTMLElement;
  const texto = () => elemento().textContent?.replace(/\s+/g, ' ') ?? '';
  const filasTotales = () =>
    [...elemento().querySelectorAll('table tr.mat-mdc-row')].map((f) =>
      f.querySelector('td')?.textContent?.trim(),
    );

  it('muestra los totales, las líneas sin lista y el árbol de cada línea', () => {
    expect(pedidos).toEqual([{ id: 9 }]);
    expect(texto()).toContain('Materiales del pedido 20451');
    expect(texto()).toContain('1 línea no tiene lista de materiales');
    expect(filasTotales()).toEqual(['LAM/0111/AH/MUL', 'POL/ABS', 'TORN-X']);
    expect(texto()).toContain('No está en el maestro de ítems');
    expect(texto()).toContain('0.081 Kg');
    expect(texto()).toContain('6 Und');
    expect(texto()).toContain('Cubierto');
    expect(texto()).toContain('(0.0081 c/u)');
    expect(texto()).toContain(
      'El código no está en el maestro de ítems ni en la lista de materiales.',
    );
    // Los árboles de las líneas empiezan cerrados
    expect(elemento().querySelector('details')?.hasAttribute('open')).toBe(false);
  });

  it('filtra los totales entre lo que se fabrica y la materia prima', async () => {
    const [, fabricados, basicos] = elemento().querySelectorAll(
      'mat-button-toggle button',
    ) as NodeListOf<HTMLButtonElement>;
    fabricados.click();
    await fixture.whenStable();
    expect(filasTotales()).toEqual(['LAM/0111/AH/MUL']);

    basicos.click();
    await fixture.whenStable();
    expect(filasTotales()).toEqual(['POL/ABS', 'TORN-X']);
  });

  it('con «Solo faltantes» oculta lo que cubren las existencias', async () => {
    (elemento().querySelector('mat-slide-toggle button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(filasTotales()).toEqual(['LAM/0111/AH/MUL', 'TORN-X']);
  });
});
