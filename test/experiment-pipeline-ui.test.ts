import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ExperimentsPage from '../src/app/(dashboard)/experiments/page';
import ResultsPage from '../src/app/(dashboard)/results/page';
import { api, type Experiment } from '../src/lib/api';

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); };
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search, () => '')) };
});
vi.mock('../src/lib/use-sites', () => ({ useSites: () => ({ siteId: 'site' }) }));
vi.mock('../src/lib/session', () => ({ useSession: () => ({ role: 'editor' }) }));
vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
let host: HTMLDivElement, root: Root;
let items: Experiment[];
const base: Experiment = { id: 'approved', name: 'Título aprovado', siteId: 'site', insightId: 'origin', status: 'approved', type: 'headline', riskScore: 15, allocation: 0.5, createdAt: '2026-11-20T12:00:00Z' };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-21T12:00:00Z'));
  window.history.replaceState(null, '', '/experiments');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation((...args: Parameters<History['pushState']>) => { original(...args); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
  host = document.createElement('div'); root = createRoot(host);
  document.body.append(host);
  items = [base, { ...base, id: 'running', name: 'Texto em teste', status: 'running', type: 'copy' }, { ...base, id: 'completed', name: 'Teste concluído', status: 'completed' }, { ...base, id: 'expired', name: 'Proposta vencida', createdAt: '2026-11-14T12:00:00Z' }, { ...base, id: 'rejected', name: 'Proposta negada', status: 'rejected', createdAt: '2026-10-01T00:00:00Z' }];
  vi.mocked(api.get).mockImplementation(async path => {
    if (path.startsWith('/experiments?')) return items;
    if (path.startsWith('/sites/site/ai/suggestions?')) return [{ id: 'origin', payload: { title: 'Insight de origem' } }];
    if (path === '/sites/site/goals') return [];
    if (path.startsWith('/analytics/experiments/')) return { variants: [] };
    return { ...items.find(item => path === `/experiments/${item.id}`), primaryGoalId: null, variants: [] };
  });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.resetAllMocks(); });
const render = async () => { await act(async () => root.render(React.createElement(ExperimentsPage))); };
async function select(id: string, value: string) {
  await act(async () => { const input = host.querySelector<HTMLSelectElement>(`#${id}`)!; input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function search(value: string) {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>('#experiment-search')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function chooseStage(label: string) {
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Etapas dos experimentos"] button')].find(button => button.textContent?.startsWith(label))!.click());
}

it('renders the five pipeline stages with correct cards and a direct results link', async () => {
  await render();
  for (const [stage, name] of [['waiting', 'Título aprovado'], ['running', 'Texto em teste'], ['results', 'Teste concluído'], ['expired', 'Proposta vencida'], ['rejected', 'Proposta negada']]) {
    expect(host.querySelector(`[aria-labelledby="stage-${stage}"] h3`)?.textContent).toBe(name);
  }
  expect(host.querySelector('[aria-labelledby="stage-waiting"]')?.textContent).toContain('Aprovado · Pronto para iniciar');
  expect(host.querySelector('a[href="/results?experiment=completed"]')).not.toBeNull();
});

it('filters immediately in memory, preserves the source insight and keeps the search input focused', async () => {
  window.history.replaceState(null, '', '/experiments?insight=origin');
  await render();
  const input = host.querySelector<HTMLInputElement>('#experiment-search')!;
  input.focus();
  await search('aprovado');
  await select('experiment-type', 'headline');
  await select('experiment-risk', 'low');
  expect(window.location.search).toContain('insight=origin');
  expect(window.location.search).toContain('type=headline');
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] h3')).toHaveLength(1);
  expect(host.textContent).toContain('1 de 5 experimentos com os filtros aplicados');
  expect(host.querySelector('#experiment-search')).toBe(input);
  expect(document.activeElement).toBe(input);
  expect([...host.querySelectorAll('button')].some(button => button.textContent === 'Aplicar')).toBe(false);
  expect(api.get).toHaveBeenCalledWith('/experiments?siteId=site');
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => path.startsWith('/experiments?'))).toHaveLength(1);
  const clear = [...host.querySelectorAll('a')].find(link => link.textContent === 'Limpar filtros')!;
  expect(clear.getAttribute('href')).toBe('/experiments?insight=origin');
  await act(async () => clear.click());
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] h3')).toHaveLength(5);
});

it('moves stage selection outside filters and expands the selected stage into the whole board', async () => {
  await render();
  expect(host.querySelector('#experiment-stage')).toBeNull();
  expect(host.querySelector('details nav')).toBeNull();
  await chooseStage('Em experimentação');
  expect(window.location.search).toBe('?stage=running');
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] section')).toHaveLength(1);
  expect(host.querySelector('[aria-labelledby="stage-running"] h3')?.textContent).toBe('Texto em teste');
  expect(host.querySelector('[aria-labelledby="stage-waiting"]')).toBeNull();
  await chooseStage('Todas as etapas');
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] section')).toHaveLength(5);
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => path.startsWith('/experiments?'))).toHaveLength(1);
});

it('combines stage, type, origin, date and ordering locally and clears other filters without clearing the stage', async () => {
  items.push({ ...base, id: 'other-running', name: 'Outro texto', status: 'running', type: 'copy', insightId: null, riskScore: 80, createdAt: '2026-11-01T00:00:00Z' });
  await render();
  await chooseStage('Em experimentação');
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] h3')).toHaveLength(2);
  await select('experiment-sort', 'oldest');
  expect(host.querySelector('[aria-label="Pipeline de experimentos"] h3')?.textContent).toBe('Outro texto');
  await select('experiment-type', 'copy');
  await select('experiment-origin', 'other');
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] h3')).toHaveLength(1);
  await select('experiment-period', '7');
  expect(host.textContent).toContain('Nenhum experimento corresponde aos filtros');
  const clear = [...host.querySelectorAll('a')].find(link => link.textContent === 'Limpar filtros')!;
  expect(clear.getAttribute('href')).toBe('/experiments?stage=running');
  await act(async () => clear.click());
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] h3')).toHaveLength(2);
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => path.startsWith('/experiments?'))).toHaveLength(1);
});

it('switches between board and list while preserving stage and filters without new reads', async () => {
  await render();
  await select('experiment-type', 'copy');
  await chooseStage('Em experimentação');
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Lista')!.click());
  expect(host.querySelector('[aria-label="Pipeline de experimentos"]')).toBeNull();
  expect(host.querySelector('#experiment-list-title')?.textContent).toBe('Em experimentação');
  expect(host.querySelectorAll('[aria-labelledby="experiment-list-title"] h3')).toHaveLength(1);
  expect(host.querySelector<HTMLSelectElement>('#experiment-type')!.value).toBe('copy');
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Quadro')!.click());
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] section')).toHaveLength(1);
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => path.startsWith('/experiments?'))).toHaveLength(1);
});

it('keeps expired proposals readable while hiding their editing and starting actions', async () => {
  window.history.replaceState(null, '', '/experiments?review=expired');
  await render();
  const detail = host.querySelector('[aria-label="Detalhes de Proposta vencida"]')!;
  expect(detail.textContent).toContain('Esta proposta venceu após 7 dias sem iniciar');
  expect([...detail.querySelectorAll('button')].map(button => button.textContent)).not.toContain('Iniciar');
  expect(detail.querySelector('form')).toBeNull();
});

it('distinguishes no matches from loading and preserves direct links to a legacy review selection', async () => {
  items.push({ ...base, id: 'pending', name: 'Revisar texto', status: 'pending_review' });
  window.history.replaceState(null, '', '/experiments?filter=review&review=pending');
  await render();
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] h3')).toHaveLength(1);
  expect(host.querySelector('[aria-label="Detalhes de Revisar texto"]')).not.toBeNull();
  window.history.replaceState(null, '', '/experiments?q=inexistente'); await render();
  expect(host.textContent).toContain('Nenhum experimento corresponde aos filtros');
  expect(host.textContent).not.toContain('Sua próxima melhoria começa');
});

it('opens results for the linked experiment instead of silently selecting another experiment', async () => {
  window.history.replaceState(null, '', '/results?experiment=completed');
  await act(async () => root.render(React.createElement(ResultsPage)));
  expect(api.get).toHaveBeenCalledWith('/analytics/experiments/completed/results');
  expect(host.querySelector<HTMLSelectElement>('#result-experiment')!.value).toBe('completed');
  expect(api.get).not.toHaveBeenCalledWith('/analytics/experiments/approved/results');
});

it('cites the approved source insight even before the experiment has exposures', async () => {
  const initial = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(path => path === '/sites/site/ai/suggestions?insightId=origin'
    ? Promise.resolve([{ id: 'origin', approvedAt: '2026-11-20T12:00:00Z', payload: { title: 'Esclarecer o benefício da chamada' } }]) : initial(path));
  window.history.replaceState(null, '', '/results?experiment=completed');
  await act(async () => root.render(React.createElement(ResultsPage)));
  const citation = host.querySelector('[aria-label="Insight de origem"]')!;
  expect(citation.querySelector('a')?.getAttribute('href')).toBe('/insights?insight=origin');
  expect(citation.textContent).toContain('Esclarecer o benefício da chamada');
  expect(citation.textContent).toContain('Aprovado em');
  expect(citation.querySelector('time')?.dateTime).toBe('2026-11-20T12:00:00Z');
  expect(host.textContent).toContain('Sem exposições');
});

it('labels the control as reference, keeps missing variant comparisons distinct and explains the statistics', async () => {
  const initial = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(path => path.startsWith('/analytics/experiments/') ? Promise.resolve({ variants: [
    { variantId: 'control', isControl: true, exposures: 100, conversions: 10, conversionRate: .1, lift: null, pValue: null, significant: false },
    { variantId: 'better', isControl: false, exposures: 100, conversions: 12, conversionRate: .12, lift: .2, pValue: .032, significant: true },
    { variantId: 'missing', isControl: false, exposures: 0, conversions: 0, conversionRate: 0, lift: null, pValue: null, significant: false },
  ] }) : initial(path));
  window.history.replaceState(null, '', '/results?experiment=completed');
  await act(async () => root.render(React.createElement(ResultsPage)));
  const rows = host.querySelectorAll('tbody tr');
  expect([...rows[0].querySelectorAll('td')].map(cell => cell.textContent)).toEqual(['Referência', 'Referência', 'Referência']);
  expect(rows[1].textContent).toContain('+20');
  expect(rows[1].textContent).toContain('0,032');
  expect(rows[2].querySelectorAll('td')[0].textContent).toBe('Indisponível');
  expect(host.textContent).not.toMatch(/N\/A|N\/D/);
  const definitions = host.querySelector('details')!;
  expect(definitions.textContent).toContain('2 pontos percentuais');
  expect(definitions.textContent).toContain('p-valor');
  expect(definitions.textContent).toContain('não representa a probabilidade de a variante ser melhor');
});

it('isolates failed insight reads from metrics and clears the citation for experiments without an origin', async () => {
  const initial = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(path => path.startsWith('/sites/site/ai/suggestions?') ? Promise.reject(new Error('Offline')) : initial(path));
  items[0] = { ...items[0], insightId: null };
  window.history.replaceState(null, '', '/results?experiment=completed');
  await act(async () => root.render(React.createElement(ResultsPage)));
  expect(host.textContent).toContain('Não foi possível carregar a referência do insight');
  expect(host.textContent).toContain('Sem exposições');
  const select = host.querySelector<HTMLSelectElement>('#result-experiment')!;
  await act(async () => { select.value = 'approved'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(host.querySelector('[aria-label="Insight de origem"]')).toBeNull();
  expect(host.textContent).toContain('não possui um insight de IA vinculado');
});
