import { toast } from '../src/components/ui/toast';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ExperimentImpact } from '../src/components/experiment-impact';
import { GoalsManager } from '../src/components/goals-manager';
import { api, type ConversionGoal, type ExperimentImpactReport } from '../src/lib/api';

const session = vi.hoisted(() => ({ role: 'editor' }));
vi.mock('../src/lib/session', () => ({ useSession: () => session }));
vi.mock('../src/lib/api', async original => ({ ...await original<typeof import('../src/lib/api')>(), api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } }));
let host: HTMLDivElement, root: Root, goals: ConversionGoal[], report: ExperimentImpactReport;
const summary = (controlRate: number | null, variantRate: number | null) => ({ control: { exposures: 100, conversions: controlRate === null ? 0 : controlRate * 100, rate: controlRate }, variants: { exposures: 100, conversions: variantRate === null ? 0 : variantRate * 100, rate: variantRate }, gainPp: controlRate === null || variantRate === null ? null : (variantRate - controlRate) * 100 });
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  session.role = 'editor';
  host = document.createElement('div'); root = createRoot(host);
  goals = [{ id: 'first', siteId: 'site', name: 'Contato', kind: 'event', matcher: {}, createdAt: '2020-01-01Z' }, { id: 'favorite', siteId: 'site', name: 'Lead confirmado', kind: 'event', matcher: {}, isFavorite: true, createdAt: '2020-01-01Z' }];
  report = {
    goal: { id: 'favorite', name: 'Lead confirmado', isFavorite: true }, timeframe: '7d',
    range: { from: '2026-11-14T00:00:00Z', to: '2026-11-21T00:00:00Z', previousFrom: '2026-11-07T00:00:00Z', previousTo: '2026-11-14T00:00:00Z' },
    coverage: { availableFrom: '2020-01-01T00:00:00Z', currentComplete: true, previousComplete: true },
    current: summary(.1, .12), previous: summary(.08, .09), excludedExposures: 2,
    series: Array.from({ length: 7 }, (_, index) => ({ from: `2026-11-${14 + index}T00:00:00Z`, to: `2026-11-${15 + index}T00:00:00Z`, values: summary(.1, .12) })),
    experiments: [{ ...summary(.1, .12), id: 'experiment', name: 'Esclarecer a chamada', status: 'running', startedAt: '2026-11-16T12:00:00Z', endedAt: null, partial: true }],
  };
  vi.mocked(api.get).mockImplementation(async path => path.includes('/goals') ? goals : report);
});
afterEach(async () => { await act(async () => root.unmount()); vi.resetAllMocks(); vi.unstubAllGlobals(); });
const render = async (siteId = 'site', timeframe: '7d' | '30d' = '7d') => { await act(async () => root.render(React.createElement(ExperimentImpact, { siteId, timeframe, refreshKey: 0 }))); };

it('defaults to the site favorite, shows observed rate KPIs and shares the selected period', async () => {
  await render();
  expect(host.querySelector<HTMLSelectElement>('#impact-goal')!.value).toBe('favorite');
  expect(api.get).toHaveBeenCalledWith('/analytics/experiment-impact?siteId=site&goalId=favorite&timeframe=7d');
  expect(host.textContent).toContain('+2 p.p.');
  expect(host.textContent).toContain('+1 p.p. em relação ao período anterior');
  expect(host.textContent).toContain('resultados são parciais');
  const select = host.querySelector<HTMLSelectElement>('#impact-goal')!;
  await act(async () => { select.value = 'first'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(api.get).toHaveBeenCalledWith('/analytics/experiment-impact?siteId=site&goalId=first&timeframe=7d');
  await render('site', '30d');
  expect(api.get).toHaveBeenCalledWith('/analytics/experiment-impact?siteId=site&goalId=first&timeframe=30d');
});

it('opens an experiment summary on hover or keyboard focus, preserves navigation and explores values with arrows', async () => {
  await render();
  const marker = host.querySelector<SVGGElement>('g[role="button"]')!;
  await act(async () => marker.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  expect(host.querySelector('a[href="/experiments?review=experiment"]')?.textContent).toBe('Ver mais');
  expect(host.querySelector('[aria-label="Resumo dos experimentos neste marco"]')?.textContent).toContain('Esclarecer a chamada');
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Fechar resumo')!.click());
  await act(async () => marker.dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
  expect(marker.getAttribute('aria-expanded')).toBe('true');
  const chart = host.querySelector('[aria-label^="Resultado dos experimentos no tempo"]')!;
  await act(async () => chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
  expect(host.querySelector('[aria-live="polite"]')?.textContent).toContain('19/11/2026');
  await act(async () => chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(host.querySelector('[aria-label="Resumo dos experimentos neste marco"]')).toBeNull();
});

it('groups nearby markers on long ranges without losing experiment dates or navigation', async () => {
  report.range.from = '2025-11-21T00:00:00Z';
  report.experiments[0].endedAt = '2026-11-17T00:00:00Z';
  report.experiments.push({ ...report.experiments[0], id: 'second', name: 'Outro teste', startedAt: '2026-11-18T00:00:00Z', endedAt: null });
  await render();
  const markers = host.querySelectorAll<SVGGElement>('g[role="button"]');
  expect(markers).toHaveLength(1);
  await act(async () => markers[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  const card = host.querySelector('[aria-label="Resumo dos experimentos neste marco"]')!;
  expect(card.textContent).toContain('16/11/2026');
  expect(card.textContent).toContain('17/11/2026');
  expect(card.textContent).toContain('18/11/2026');
  expect(card.querySelector('a[href="/experiments?review=experiment"]')).not.toBeNull();
  expect(card.querySelector('a[href="/experiments?review=second"]')).not.toBeNull();
});

it('keeps unavailable coverage and absent goals distinct from zero results', async () => {
  report.coverage.previousComplete = false;
  await render();
  expect(host.textContent).toContain('Sem base para comparar');
  expect(host.textContent).toContain('Histórico parcial');
  goals = [];
  await render('other-site');
  expect(host.textContent).toContain('Defina o objetivo deste site');
  expect(host.querySelector('svg')).toBeNull();
});

it('discards late report data after changing the active site', async () => {
  let release: (value: ExperimentImpactReport) => void = () => {};
  vi.mocked(api.get).mockImplementation(path => path.includes('/goals') ? Promise.resolve(goals) : path.includes('siteId=site&') ? new Promise(resolve => { release = resolve; }) : Promise.resolve(report));
  await render();
  expect(host.textContent).toContain('Calculando');
  await render('other-site');
  await act(async () => release({ ...report, goal: { ...report.goal, name: 'Site anterior' } }));
  expect(host.textContent).not.toContain('Site anterior');
  expect(host.textContent).toContain('Lead confirmado');
});

it('reports request failures and retries the analysis read without generating insights', async () => {
  vi.mocked(api.get).mockImplementation(path => path.includes('/goals') ? Promise.resolve(goals) : Promise.reject(new Error('Offline')));
  await render();
  expect(host.textContent).toContain('Não foi possível consultar o resultado');
  vi.mocked(api.get).mockImplementation(async path => path.includes('/goals') ? goals : report);
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Tentar novamente')!.click());
  expect(host.textContent).toContain('Diferença observada');
  expect(api.post).not.toHaveBeenCalled();
});

it('sets a favorite on an existing goal, preserves the previous value on failure and hides edits from viewers', async () => {
  await act(async () => root.render(React.createElement(GoalsManager, { siteId: 'site', onChanged: vi.fn() })));
  vi.mocked(api.patch).mockResolvedValue({});
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Definir como favorita')!.click());
  expect(api.patch).toHaveBeenCalledWith('/sites/site/goals/first', { isFavorite: true });
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Meta favorita definida'));
  vi.mocked(api.patch).mockRejectedValue(new Error('Falha ao salvar'));
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Remover favorita')!.click());
  expect(toast.error).toHaveBeenCalledWith('Falha ao salvar');
  expect(host.querySelector('button[aria-pressed="true"]')).not.toBeNull();
  session.role = 'viewer';
  await act(async () => root.render(React.createElement(GoalsManager, { siteId: 'site', onChanged: vi.fn() })));
  expect(host.querySelector('form')).toBeNull();
  expect(host.querySelector('button[aria-pressed]')).toBeNull();
});

it('includes the favorite flag when creating a conversion goal', async () => {
  await act(async () => root.render(React.createElement(GoalsManager, { siteId: 'site', onChanged: vi.fn() })));
  const name = host.querySelector<HTMLInputElement>('input[placeholder="lead_received"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Lead');
    name.dispatchEvent(new Event('input', { bubbles: true }));
    host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
  });
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.post).toHaveBeenCalledWith('/sites/site/goals', { name: 'Lead', kind: 'event', isFavorite: true });
});

vi.mock('../src/components/ui/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
