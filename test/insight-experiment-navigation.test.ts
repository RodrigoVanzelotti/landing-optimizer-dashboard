import * as React from 'react';
import './dialog-mock';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ExperimentsPage from '../src/app/(dashboard)/experiments/page';
import { api, type Experiment, type InsightSuggestion } from '../src/lib/api';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock('../src/lib/use-sites', () => ({ useSites: () => ({ siteId: 'site' }) }));
vi.mock('../src/lib/session', () => ({ useSession: () => ({ role: 'viewer' }) }));
vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
let host: HTMLDivElement, root: Root;
let origin: InsightSuggestion, experiments: Experiment[];
const experiment: Experiment = { id: 'first', name: 'Chamada principal', siteId: 'site', insightId: 'origin', type: 'cta', status: 'approved', allocation: 0.5, riskScore: 15, createdAt: '2026-11-21T12:00:00Z' };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-21T13:00:00Z'));
  window.history.replaceState(null, '', '/experiments?insight=origin&review=first');
  host = document.createElement('div'); root = createRoot(host);
  origin = { id: 'origin', model: 'production', kind: 'cta', riskLevel: 'low', expectedImpact: null, approvedAt: '2026-11-21T12:00:00Z', experimentsReadyAt: '2026-11-21T13:00:00Z', experiments: [], payload: { title: 'Clareza da chamada' } };
  experiments = [experiment];
  vi.mocked(api.get).mockImplementation(async path => {
    if (path.startsWith('/experiments?')) return experiments;
    if (path.startsWith('/approvals?')) return [];
    if (path.startsWith('/sites/site/ai/suggestions?')) return [origin];
    if (path === '/sites/site/goals') return [];
    return { ...experiments.find(row => path === `/experiments/${row.id}`), primaryGoalId: null, variants: [] };
  });
});
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); vi.resetAllMocks(); });

it('scopes the pipeline by insight and links back from the card and experiment details', async () => {
  await act(async () => root.render(React.createElement(ExperimentsPage)));
  expect(api.get).toHaveBeenCalledWith('/experiments?siteId=site');
  expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/approvals?'));
  expect(host.textContent).toContain('Clareza da chamada');
  expect(host.querySelectorAll('a[href="/insights?insight=origin"]').length).toBeGreaterThanOrEqual(3);
  expect(host.querySelector('[aria-label="Pipeline de experimentos"]')).not.toBeNull();
  expect(host.querySelector('a[href="/experiments"]')?.textContent).toBe('Ver todos os experimentos');
});

it('shows pending preparation instead of claiming there are no approved insights or inventing experiments', async () => {
  experiments = []; origin.experimentsReadyAt = null;
  window.history.replaceState(null, '', '/experiments?insight=origin');
  await act(async () => root.render(React.createElement(ExperimentsPage)));
  expect(host.textContent).toContain('Seus experimentos estão sendo preparados');
  expect(host.textContent).toContain('em até 24 horas');
  expect(host.textContent).toContain('já aprovados e prontos para iniciar');
  expect(host.textContent).not.toContain('Sua próxima melhoria começa');
  expect(host.textContent).not.toMatch(/batch|processamento em lote/i);
  experiments = [experiment]; origin.experimentsReadyAt = '2026-11-21T13:00:00Z';
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Atualizar')!.click());
  expect(host.textContent).not.toContain('Seus experimentos estão sendo preparados');
  expect(host.textContent).toContain('Chamada principal');
  expect(api.post).not.toHaveBeenCalled();
});

it('clearly acknowledges an exceeded deadline rather than repeating an expired promise', async () => {
  experiments = []; origin.approvedAt = '2026-11-19T12:00:00Z'; origin.experimentsReadyAt = null;
  await act(async () => root.render(React.createElement(ExperimentsPage)));
  expect(host.textContent).toContain('A preparação está demorando mais que o previsto');
  expect(host.textContent).toContain('O prazo de 24 horas após a aprovação do insight foi ultrapassado');
});

it('keeps the site list in memory and ignores stale origin metadata after changing the insight filter', async () => {
  let release: (rows: InsightSuggestion[]) => void = () => {};
  const initial = vi.mocked(api.get).getMockImplementation()!;
  const oldOrigin = origin;
  experiments = [experiment, { ...experiment, id: 'second', name: 'Outro teste', insightId: 'other' }];
  vi.mocked(api.get).mockImplementation(path => path === '/sites/site/ai/suggestions?insightId=origin' ? new Promise(resolve => { release = resolve; }) : initial(path));
  await act(async () => root.render(React.createElement(ExperimentsPage)));
  window.history.replaceState(null, '', '/experiments?insight=other');
  origin = { ...origin, id: 'other', payload: { title: 'Outro insight' } };
  await act(async () => root.render(React.createElement(ExperimentsPage)));
  await act(async () => release([oldOrigin]));
  expect(host.textContent).toContain('Outro teste');
  expect(host.textContent).not.toContain('Chamada principal');
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => path.startsWith('/experiments?'))).toHaveLength(1);
});

it('reports failed preparation-state reads as errors instead of showing a misleading empty state', async () => {
  const initial = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(path => path.startsWith('/sites/site/ai/suggestions?') ? Promise.reject(new Error('Sem conexão')) : initial(path));
  await act(async () => root.render(React.createElement(ExperimentsPage)));
  expect(host.textContent).toContain('Não foi possível carregar os experimentos');
  expect(host.textContent).not.toContain('Sua próxima melhoria começa');
});
