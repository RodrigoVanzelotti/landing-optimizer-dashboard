import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ResultsPage from '../src/app/(dashboard)/results/page';
import { api, type ExperimentResult } from '../src/lib/api';
import { orderResults, relativeEffect, resultEvidence } from '../src/lib/results';

const scope = vi.hoisted(() => ({ siteId: 'site' }));
vi.mock('../src/lib/use-sites', () => ({ useSites: () => scope }));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); };
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search, () => '')) };
});
vi.mock('../src/lib/api', () => ({ api: { get: vi.fn() } }));
const control = { variantId: 'control', name: 'Página atual', isControl: true, exposures: 1000, conversions: 100, conversionRate: .1, lift: null, pValue: null, significant: false };
const variant = { ...control, variantId: 'variant', name: 'Nova chamada', isControl: false, conversions: 150, conversionRate: .15, lift: .5, pValue: .001, significant: true };
const make = (id: string, row: ExperimentResult['variants'][number] = variant): ExperimentResult => ({ experimentId: id, experiment: { id, siteId: 'site', name: `Experimento ${id}`, status: 'completed', type: 'cta', allocation: .5, riskScore: 15, insightId: 'origin', createdAt: '2026-11-01T00:00:00Z', startedAt: '2026-11-05T00:00:00Z' }, goal: { id: 'goal', name: 'Leads confirmados' }, variants: [control, row] });
let host: HTMLDivElement, root: Root, rows: ExperimentResult[];
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, '', '/results');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation((...args: Parameters<History['pushState']>) => { original(...args); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
  scope.siteId = 'site';
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  rows = [make('win'), make('decline', { ...variant, conversions: 50, conversionRate: .05, lift: -.5 }), make('inconclusive', { ...variant, conversions: 110, conversionRate: .11, lift: .1, significant: false, pValue: .4 }), make('small', { ...variant, exposures: 10, conversions: 5, conversionRate: .5, lift: 4, significant: false, pValue: null })];
  vi.mocked(api.get).mockImplementation(async path => path.endsWith('/report') ? { ...rows.find(row => path === `/analytics/experiments/${row.experimentId}/report`), series: [], evidence: [], plan: null, coverageComplete: true, conclusive: true, conversionWindowHours: 24 } : path.startsWith('/analytics/experiments/results?') ? rows : [{ id: 'origin', approvedAt: '2026-11-04T12:00:00Z', payload: { title: 'Tornar a chamada mais clara' } }]);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.resetAllMocks(); });
const render = async () => { await act(async () => root.render(React.createElement(ResultsPage))); };
async function open(id: string) { await act(async () => host.querySelector<HTMLAnchorElement>(`#result-card-${id} a[role="button"]`)!.click()); }

it('distinguishes actual improvements, declines, inconclusive and insufficient evidence', () => {
  expect(resultEvidence(control).kind).toBe('reference');
  expect(resultEvidence(variant, control).kind).toBe('improvement');
  expect(resultEvidence(rows[1].variants[1], control).kind).toBe('decline');
  expect(resultEvidence(rows[2].variants[1], control).kind).toBe('inconclusive');
  expect(resultEvidence(rows[3].variants[1], control).kind).toBe('insufficient');
  expect(resultEvidence(variant).kind).toBe('insufficient');
  expect(resultEvidence({ ...variant, pValue: null, significant: false, decision: 'equivalent' }, control).kind).toBe('equivalent');
  expect(resultEvidence({ ...variant, significant: true, decision: 'collecting' }, control).kind).toBe('inconclusive');
  expect(relativeEffect({ ...variant, exposures: 0, lift: -1 }, control)).toBeNull();
});

it('shows every experiment with its relative effect and evidence before expanding any card', async () => {
  await render();
  expect(host.querySelector('#result-experiment')).toBeNull();
  expect(host.querySelectorAll('[id^="result-card-"]')).toHaveLength(4);
  expect(host.querySelector('#result-card-win')?.textContent).toContain('+50%');
  expect(host.querySelector('#result-card-win')?.textContent).toContain('Melhora significativa');
  expect(host.querySelector('#result-card-decline')?.textContent).toContain('Queda significativa');
  expect(host.querySelector('#result-card-inconclusive')?.textContent).toContain('Sem diferença significativa');
  expect(host.querySelector('#result-card-small')?.textContent).toContain('Dados insuficientes');
  expect(host.querySelector('table')).toBeNull();
  expect(vi.mocked(api.get).mock.calls).toEqual([['/analytics/experiments/results?siteId=site']]);
});

it('puts the visual outcome before charts, preserves the source citation and supports collapsing without rereads', async () => {
  await render(); await open('win');
  const detail = host.querySelector('[aria-label="Detalhes do resultado de Experimento win"]')!;
  expect(detail.querySelector('section')?.textContent).toContain('Uma melhoria com evidência estatística');
  expect(detail.querySelector('section')?.textContent).toContain('+50%');
  expect(detail.querySelector('[aria-label="Insight de origem"] a')?.getAttribute('href')).toBe('/insights?insight=origin');
  expect(detail.querySelector('time')?.dateTime).toBe('2026-11-04T12:00:00Z');
  expect([...detail.querySelectorAll('tbody tr')][0].textContent).toContain('Referência');
  const calls = vi.mocked(api.get).mock.calls.length;
  await open('win');
  expect(host.querySelector('#result-card-win a[role="button"]')?.getAttribute('aria-expanded')).toBe('false');
  await open('win');
  expect(api.get).toHaveBeenCalledTimes(calls);
});

it('sorts in memory by effect, exposures and actual start date, with unavailable values last', async () => {
  rows[0].experiment.startedAt = '2026-11-10T00:00:00Z';
  rows[1].variants[1].exposures = 3000;
  rows[3].experiment.startedAt = null;
  await render();
  for (const [value, expected] of [['lift-asc', 'decline'], ['exposures-desc', 'decline'], ['start-desc', 'win']]) {
    await act(async () => { const select = host.querySelector<HTMLSelectElement>('#result-order')!; select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.querySelector('[id^="result-card-"]')?.id).toBe(`result-card-${expected}`);
  }
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => path.startsWith('/analytics/experiments/results?'))).toHaveLength(1);
  expect(orderResults(rows, 'start-asc').at(-1)?.experimentId).toBe('small');
});

it('keeps all variant evidence visible and does not label a zero-exposure variant as a decline', async () => {
  rows[0].variants.push({ ...variant, variantId: 'other', name: 'Outra alternativa', conversions: 50, conversionRate: .05, lift: -.5 });
  rows[1].variants[1] = { ...variant, exposures: 0, conversions: 0, conversionRate: 0, lift: -1, significant: false, pValue: null };
  await render();
  expect(host.querySelector('#result-card-win')?.textContent).toContain('Melhora significativa');
  expect(host.querySelector('#result-card-win')?.textContent).toContain('Queda significativa');
  expect(host.querySelector('#result-card-decline')?.textContent).not.toContain('-100%');
  await open('win');
  expect(host.querySelectorAll('#result-details-win section[aria-label^="Resultado de "]')).toHaveLength(2);
});

it('honors deep links, marks ongoing results as partial and handles a zero control without infinite relative lift', async () => {
  rows[0].experiment.status = 'running'; rows[0].variants[0] = { ...control, conversions: 0, conversionRate: 0 }; rows[0].variants[1] = { ...variant, lift: null };
  window.history.replaceState(null, '', '/results?experiment=win');
  await render();
  expect(host.querySelector('#result-card-win a[role="button"]')?.getAttribute('aria-expanded')).toBe('true');
  expect(host.querySelector('#result-details-win')?.textContent).toContain('Resultado parcial');
  expect(host.querySelector('#result-details-win')?.textContent).toContain('15 p.p.');
  expect(host.textContent).not.toMatch(/NaN|Infinity/);
});

it('isolates site changes from stale reads and distinguishes errors from empty results', async () => {
  let release: (value: ExperimentResult[]) => void = () => {};
  vi.mocked(api.get).mockImplementation(path => path.endsWith('siteId=site') ? new Promise(resolve => { release = resolve; }) : Promise.resolve([]));
  await render(); scope.siteId = 'other'; await render();
  await act(async () => release(rows));
  expect(host.textContent).toContain('Seus próximos resultados começam');
  expect(host.textContent).not.toContain('Experimento win');
  scope.siteId = 'failed'; vi.mocked(api.get).mockRejectedValue(new Error('Offline')); await render();
  expect(host.textContent).toContain('Resultados indisponíveis');
  expect(host.textContent).not.toContain('Seus próximos resultados começam');
});
