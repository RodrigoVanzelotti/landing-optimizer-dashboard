import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ExperimentsPage from '../src/app/(dashboard)/experiments/page';
import ResultsPage from '../src/app/(dashboard)/results/page';
import { api, type Experiment } from '../src/lib/api';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
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
  host = document.createElement('div'); root = createRoot(host);
  items = [base, { ...base, id: 'running', name: 'Texto em teste', status: 'running', type: 'copy' }, { ...base, id: 'completed', name: 'Teste concluído', status: 'completed' }, { ...base, id: 'expired', name: 'Proposta vencida', createdAt: '2026-11-14T12:00:00Z' }, { ...base, id: 'rejected', name: 'Proposta negada', status: 'rejected', createdAt: '2026-10-01T00:00:00Z' }];
  vi.mocked(api.get).mockImplementation(async path => {
    if (path.startsWith('/experiments?')) return items;
    if (path.startsWith('/sites/site/ai/suggestions?')) return [{ id: 'origin', payload: { title: 'Insight de origem' } }];
    if (path === '/sites/site/goals') return [];
    if (path.startsWith('/analytics/experiments/')) return { variants: [] };
    return { ...items.find(item => path === `/experiments/${item.id}`), primaryGoalId: null, variants: [] };
  });
});
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); vi.resetAllMocks(); });
const render = async () => { await act(async () => root.render(React.createElement(ExperimentsPage))); };

it('renders the five pipeline stages with correct cards and a direct results link', async () => {
  await render();
  for (const [stage, name] of [['waiting', 'Título aprovado'], ['running', 'Texto em teste'], ['results', 'Teste concluído'], ['expired', 'Proposta vencida'], ['rejected', 'Proposta negada']]) {
    expect(host.querySelector(`[aria-labelledby="stage-${stage}"] h3`)?.textContent).toBe(name);
  }
  expect(host.querySelector('[aria-labelledby="stage-waiting"]')?.textContent).toContain('Aprovado · Pronto para iniciar');
  expect(host.querySelector('a[href="/results?experiment=completed"]')).not.toBeNull();
});

it('applies combined filters to the URL, preserves the insight origin and restores the unfiltered board', async () => {
  window.history.replaceState(null, '', '/experiments?insight=origin');
  await render();
  host.querySelector<HTMLInputElement>('#experiment-search')!.value = 'aprovado';
  host.querySelector<HTMLSelectElement>('#experiment-type')!.value = 'headline';
  host.querySelector<HTMLSelectElement>('#experiment-risk')!.value = 'low';
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await render();
  expect(window.location.search).toContain('insight=origin');
  expect(window.location.search).toContain('type=headline');
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] h3')).toHaveLength(1);
  expect(host.textContent).toContain('1 de 5 experimentos com os filtros aplicados');
  const clear = [...host.querySelectorAll('a')].find(link => link.textContent === 'Limpar filtros')!;
  expect(clear.getAttribute('href')).toBe('/experiments?insight=origin');
  await act(async () => clear.click()); await render();
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] h3')).toHaveLength(5);
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
