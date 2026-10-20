import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Api } from '../../api/api';
import { estadosPedidoListar } from '../../api/fn/catalogo-estados-de-pedido/estados-pedido-listar';
import { dashboardBuscarPedidos } from '../../api/fn/tablero-e-indicadores/dashboard-buscar-pedidos';
import { dashboardVendedores } from '../../api/fn/tablero-e-indicadores/dashboard-vendedores';
import { ListadoPedidos } from './listado-pedidos';
import { UltimoListado } from './ultimo-listado';

describe('ListadoPedidos', () => {
  let fixture: ComponentFixture<ListadoPedidos>;
  let busquedas: { pageable: unknown; body: unknown }[];
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    busquedas = [];
    const api = {
      invoke: vi.fn((fn: unknown, params: { pageable: unknown; body: unknown }) => {
        if (fn === estadosPedidoListar) return Promise.resolve([{ id: 1, nombre: 'Creado' }]);
        if (fn === dashboardVendedores) return Promise.resolve(['Ana Pérez', 'Luis Gómez']);
        if (fn === dashboardBuscarPedidos) {
          busquedas.push(params);
          return Promise.resolve({
            content: [
              {
                id: 9,
                numeroPedido: '20451',
                clienteRazonSocial: 'Ferretería El Tornillo',
                ciudad: 'Cali',
                pais: 'Colombia',
                estadoActual: { id: 1, nombre: 'Creado' },
                fechaCreacionFm: '2026-10-01T15:00:00',
                fechaEstimadaEntrega: '2026-10-08',
                atrasado: true,
                lineas: 2,
                piezasSolicitadas: 20,
                piezasProcesadas: 8,
              },
            ],
            page: { number: 0, size: 25, totalElements: 1, totalPages: 1 },
          });
        }
        return Promise.reject(new Error('inesperado'));
      }),
    };
    TestBed.configureTestingModule({
      imports: [ListadoPedidos],
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ListadoPedidos);
    fixture.componentRef.setInput('estados', '1');
    fixture.componentRef.setInput('atrasados', '1');
    fixture.componentRef.setInput('orden', 'fechaEstimadaEntrega,asc');
    fixture.componentRef.setInput('pagina', '2');
    await fixture.whenStable();
  });

  const texto = () =>
    (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

  it('consulta con los filtros, el orden y la página de la URL', () => {
    expect(busquedas.at(-1)).toEqual({
      pageable: { page: 2, size: 25, sort: ['fechaEstimadaEntrega,asc'] },
      body: {
        numeroPedido: undefined,
        ciudad: undefined,
        vendedores: undefined,
        estadosIds: [1],
        fechaDesde: undefined,
        fechaHasta: undefined,
        soloAbiertos: true,
        soloAtrasados: true,
      },
    });
    expect(texto()).toContain('20451');
    expect(texto()).toContain('Atrasado:');
    expect(texto()).toContain('8 / 20 piezas');
    expect(
      (fixture.nativeElement.querySelector('a[href="/pedidos/9"]') as HTMLAnchorElement)
        .textContent,
    ).toContain('20451');
  });

  it('al buscar escribe los filtros en la URL y vuelve a la primera página', async () => {
    const [numero, ciudad] = fixture.nativeElement.querySelectorAll(
      'input[type=search]',
    ) as NodeListOf<HTMLInputElement>;
    numero.value = '204';
    numero.dispatchEvent(new Event('input'));
    ciudad.value = 'Bogotá';
    ciudad.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    expect(navegar).toHaveBeenCalledWith([], {
      queryParams: {
        numero: '204',
        ciudad: 'Bogotá',
        vendedor: null,
        estados: '1',
        desde: null,
        hasta: null,
        abiertos: null,
        atrasados: '1',
        pagina: null,
        orden: 'fechaEstimadaEntrega,asc',
      },
      queryParamsHandling: 'merge',
    });
  });

  it('filtra por varios vendedores y conserva los de la URL que ya no están en la lista', async () => {
    fixture.componentRef.setInput('vendedor', ['Marta Ruiz', 'Ana Pérez']);
    await fixture.whenStable();
    const select = fixture.nativeElement.querySelector('.vendedores mat-select') as HTMLElement;
    expect(select.textContent?.replace(/\s+/g, ' ').trim()).toBe('Marta Ruiz (+1)');
    expect(busquedas.at(-1)?.body).toMatchObject({ vendedores: ['Marta Ruiz', 'Ana Pérez'] });
    select.click();
    await fixture.whenStable();
    const opciones = [...document.querySelectorAll('mat-option')].map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Marta Ruiz', 'Ana Pérez', 'Luis Gómez']);
  });

  it('recuerda la URL del listado para volver desde el detalle', () => {
    expect(TestBed.inject(UltimoListado).url()).toBe(TestBed.inject(Router).url);
  });
});
