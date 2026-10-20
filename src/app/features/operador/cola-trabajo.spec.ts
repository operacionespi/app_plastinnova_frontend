import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Api } from '../../api/api';
import { estadosDetalleListar } from '../../api/fn/catalogo-estados-de-linea/estados-detalle-listar';
import { pedidoDetalleBuscarLineas } from '../../api/fn/lineas-de-pedido/pedido-detalle-buscar-lineas';
import { Sesion } from '../../core/auth/sesion';
import { ColaTrabajo } from './cola-trabajo';

describe('ColaTrabajo', () => {
  const catalogo = [
    { id: 3, nombre: 'En ensamble', ordenLogico: 30 },
    { id: 7, nombre: 'Entregado', ordenLogico: 70, esFinal: true },
    { id: 1, nombre: 'Creado', ordenLogico: 10 },
  ];
  let busquedas: { pageable: { size: number }; body: Record<string, unknown> }[];
  let fixture: ComponentFixture<ColaTrabajo>;

  beforeEach(async () => {
    localStorage.clear();
    busquedas = [];
    const api = {
      invoke: vi.fn((fn: unknown, params: (typeof busquedas)[number]) => {
        if (fn === estadosDetalleListar) return Promise.resolve(catalogo);
        if (fn === pedidoDetalleBuscarLineas) {
          busquedas.push(params);
          const etapa = (params.body['estadosIds'] as number[])[0];
          return Promise.resolve({ content: [], page: { totalElements: etapa === 1 ? 12 : 4 } });
        }
        return Promise.reject(new Error('inesperado'));
      }),
    };
    TestBed.configureTestingModule({
      imports: [ColaTrabajo],
      providers: [
        { provide: Api, useValue: api },
        { provide: Sesion, useValue: { tienePermiso: () => true } },
      ],
    });
    fixture = TestBed.createComponent(ColaTrabajo);
    await fixture.whenStable();
  });

  const etapas = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('mat-button-toggle')]
      .map((t) => t.textContent?.replace(/\s+/g, ' ').trim())
      .slice(0, 2);
  const listado = () => busquedas.filter((b) => b.pageable.size > 1);

  it('muestra las etapas no finales en orden, con su total de líneas', () => {
    expect(etapas()).toEqual(['Creado 12 líneas', 'En ensamble 4 líneas']);
    // La primera etapa queda elegida y se listan sus líneas
    expect(listado().at(-1)?.body).toEqual({ estadosIds: [1], tipoAlistamiento: undefined });
  });

  it('filtra por alistamiento y recuerda la elección', async () => {
    const internacional = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('mat-button-toggle button'),
    ].find((b) => b.textContent?.includes('Internacional')) as HTMLButtonElement;
    internacional.click();
    await fixture.whenStable();
    expect(listado().at(-1)?.body).toEqual({ estadosIds: [1], tipoAlistamiento: 'INTERNACIONAL' });
    expect(JSON.parse(localStorage.getItem('pi.cola')!)).toEqual({
      etapaId: 1,
      alistamiento: 'INTERNACIONAL',
    });
  });
});
