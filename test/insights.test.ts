import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import InsightsPage from '../src/app/(dashboard)/insights/page';
import { api } from '../src/lib/api';
import type { InsightSuggestion } from '../src/lib/api';

const state = vi.hoisted(() => ({ siteId: 'site', role: 'admin' }));
vi.mock('../src/lib/session', () => ({ useSession: () => ({ role: state.role }) }));
vi.mock('../src/lib/use-sites', () => ({ useSites: () => ({ siteId: state.siteId, loading: false, error: null }) }));
vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.siteId = 'site'; state.role = 'admin';
  host = document.createElement('div'); root = createRoot(host);
  vi.mocked(api.get).mockResolvedValue([]);
});
afterEach(async () => { await act(async () => root.unmount()); vi.resetAllMocks(); });

it.each(['admin', 'viewer'])('explains generation as data arrives for a registered site without insights (%s)', async role => {
  state.role = role;
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.textContent).toContain('Os insights serão gerados conforme os dados do seu site forem recebidos.');
  expect(host.querySelector('button')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});

it('hides seeded demonstrations and preserves real insights and experiment actions', async () => {
  const suggestion = { id: 'real', model: 'production', kind: 'cta', riskLevel: 'low', experimentId: null, payload: { title: 'Insight real', selector: '#cta', proposedValue: 'Solicitar contato' } };
  vi.mocked(api.get).mockResolvedValue([
    { ...suggestion, id: 'demo-model', model: 'synthetic-demo', payload: { title: 'Resultado de demonstração' } },
    { ...suggestion, id: 'stub-model', model: 'stub-v1', payload: { title: 'Fallback de demonstração' } },
    { ...suggestion, id: 'demo-title', payload: { title: '[MOCK] Exemplo' } },
    suggestion,
  ]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.textContent).toContain('Insight real');
  expect(host.textContent).not.toContain('Resultado de demonstração');
  expect(host.textContent).not.toContain('[MOCK]');
  expect(host.textContent).not.toContain('Fallback de demonstração');
  expect([...host.querySelectorAll('button')].map(button => button.textContent?.trim())).toEqual(['Criar experimento']);
});

const period = {
  from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z', timezone: 'UTC' as const,
  observedFrom: '2026-10-01T00:00:00.000Z', partial: false, sessions: 80, pageViews: 100,
  comparison: { from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' },
};
const clickKpi = { key: 'ctaClicksPerView', label: 'Cliques em CTA / visualização', value: 0.2, previousValue: 0.1, unit: 'ratio' as const, numerator: 20, denominator: 100, definition: 'Eventos de clique divididos por visualizações; não representa visitantes únicos.' };
function insight(id: string, payload: InsightSuggestion['payload']): InsightSuggestion {
  return { id, model: 'production', kind: 'cta', riskLevel: 'low', experimentId: null, expectedImpact: null, payload: { title: `Insight ${id}`, detail: 'Hipótese para testar.', ...payload } };
}

it('renders different evidence blocks for each insight and exposes calculations interactively', async () => {
  vi.mocked(api.get).mockResolvedValue([
    insight('two-kpis', { kpis: [clickKpi, { key: 'ctaClicks', label: 'Cliques em CTA', value: 20, unit: 'count', definition: 'Eventos de clique.' }], analysisPeriod: period }),
    insight('design-and-kpi', { kpis: [clickKpi], analysisPeriod: period, designContext: { selector: '#cta', pagePath: '/pricing', capturedAt: '2026-10-30T12:00:00Z', text: 'Saiba mais', observation: 'A chamada pode ser mais específica.' } }),
  ]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  const blocks = host.querySelectorAll('section[aria-label="Fundamentação do insight"]');
  expect(blocks).toHaveLength(2);
  expect(blocks[0].querySelectorAll('dl[aria-label="KPIs relacionados"] > div')).toHaveLength(2);
  expect(blocks[1].querySelectorAll('dl[aria-label="KPIs relacionados"] > div')).toHaveLength(1);
  expect(blocks[0].querySelector('section[aria-label="Elemento relacionado"]')).toBeNull();
  expect(blocks[1].textContent).toContain('Texto registrado: “Saiba mais”');
  expect(blocks[0].textContent).toContain('80 sessões');
  expect(blocks[0].textContent).toContain('20%');
  expect(blocks[0].textContent).toContain('Base de cálculo: 20 / 100.');
  expect(blocks[0].textContent).toContain('Período anterior: 10%.');
  const details = blocks[0].querySelector('details')!;
  expect(details.open).toBe(false); details.querySelector('summary')!.click(); expect(details.open).toBe(true);
  expect(details.textContent).toContain('não comprovam causalidade');
  expect(details.querySelector('a')?.getAttribute('href')).toBe('/overview?tab=data');
});

it('supports design context without a KPI block and flags legacy insights without evidence', async () => {
  vi.mocked(api.get).mockResolvedValue([
    insight('design-only', { designContext: { selector: '#title', pagePath: '/', capturedAt: '2026-10-30T12:00:00Z', text: 'Título registrado' } }),
    insight('legacy', {}),
  ]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.querySelector('dl[aria-label="KPIs relacionados"]')).toBeNull();
  expect(host.querySelectorAll('section[aria-label="Fundamentação do insight"]')).toHaveLength(1);
  expect(host.textContent).toContain('Este insight não possui KPIs ou elementos de suporte registrados');
});

it('distinguishes missing values, true zero and partial coverage without showing invented comparisons', async () => {
  vi.mocked(api.get).mockResolvedValue([insight('partial', { analysisPeriod: { ...period, partial: true, observedFrom: '2026-10-15T00:00:00Z', comparison: undefined }, kpis: [
    { ...clickKpi, value: null, previousValue: undefined, numerator: 0, denominator: 0 },
    { key: 'conversions', label: 'Conversões', value: 0, unit: 'count', definition: 'Eventos de conversão.' },
  ] })]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.textContent).toContain('Cobertura parcial a partir de 15/10/2026');
  expect([...host.querySelectorAll('dl[aria-label="KPIs relacionados"] dd')].map(node => node.textContent)).toEqual(['Sem dados', '0']);
  expect(host.textContent).not.toContain('Período anterior:');
});

it('prevents repeat clicks while creating an experiment and links to the resulting draft', async () => {
  const item = insight('actionable', { selector: '#cta', proposedValue: 'Conhecer planos', kpis: [clickKpi] });
  vi.mocked(api.get).mockResolvedValue([item]);
  let complete: (value: unknown) => void = () => {};
  vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  await act(async () => root.render(React.createElement(InsightsPage)));
  const button = host.querySelector<HTMLButtonElement>('button')!;
  await act(async () => { button.click(); });
  expect(button.disabled).toBe(true);
  expect(button.textContent).toContain('Criando experimento');
  button.click(); expect(api.post).toHaveBeenCalledExactlyOnceWith('/ai/suggestions/actionable/materialize');
  vi.mocked(api.get).mockResolvedValue([{ ...item, experimentId: 'experiment' }]);
  await act(async () => complete({ experimentId: 'experiment' }));
  expect(host.querySelector('a[href="/experiments?review=experiment"]')?.textContent).toBe('Ver experimento');
});

it('lets viewers inspect evidence without exposing experiment creation', async () => {
  state.role = 'viewer';
  vi.mocked(api.get).mockResolvedValue([insight('read-only', { selector: '#cta', proposedValue: 'Conhecer planos', kpis: [clickKpi] })]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.querySelector('details')).not.toBeNull();
  expect(host.querySelector('button')).toBeNull();
});

it('shows the ingestion notice when the API only returns demonstrations', async () => {
  vi.mocked(api.get).mockResolvedValue([{ id: 'demo', model: 'synthetic-demo', payload: { title: '[MOCK] Exemplo' } }]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.textContent).toContain('Os insights serão gerados conforme os dados do seu site forem recebidos.');
});

it('asks for a site when none is registered instead of promising insights', async () => {
  state.siteId = '';
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.textContent).toContain('Primeiro, conecte seu site');
  expect(host.textContent).not.toContain('Os insights serão gerados conforme');
  expect(api.get).not.toHaveBeenCalled();
});

it('shows a recoverable error instead of treating a failed read as an empty result', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Sem conexão')).mockResolvedValueOnce([]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.textContent).toContain('Não foi possível consultar os insights');
  expect(host.textContent).not.toContain('Os insights serão gerados conforme');
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(host.textContent).toContain('Os insights serão gerados conforme');
});
