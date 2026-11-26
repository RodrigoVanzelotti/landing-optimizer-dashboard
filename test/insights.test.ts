import { toast } from '../src/components/ui/toast';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import InsightsPage from '../src/app/(dashboard)/insights/page';
import { api } from '../src/lib/api';
import type { InsightSuggestion } from '../src/lib/api';

const state = vi.hoisted(() => ({ siteId: 'site', role: 'admin', insightId: '' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.insightId ? { insight: state.insightId } : {}) }));
vi.mock('../src/lib/session', () => ({ useSession: () => ({ role: state.role }) }));
vi.mock('../src/lib/use-sites', () => ({ useSites: () => ({ siteId: state.siteId, loading: false, error: null }) }));
vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
let host: HTMLDivElement, root: Root;
function button(label: string) { return [...host.querySelectorAll('button')].find(node => node.textContent === label)!; }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.siteId = 'site'; state.role = 'admin'; state.insightId = '';
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-21T13:00:00Z'));
  vi.mocked(api.get).mockResolvedValue([]);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.resetAllMocks(); });

it.each(['admin', 'viewer'])('explains generation as data arrives for a registered site without insights (%s)', async role => {
  state.role = role;
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.textContent).toContain('Os insights serão gerados conforme os dados do seu site forem recebidos.');
  expect(host.querySelector('button')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});

it('hides seeded demonstrations and preserves real insights and experiment actions', async () => {
  const suggestion = { id: 'real', model: 'production', kind: 'cta', riskLevel: 'low', approvedAt: null, experiments: [], payload: { title: 'Insight real', selector: '#cta', proposedValue: 'Solicitar contato' } };
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
  expect(button('Aprovar insight')).toBeDefined(); expect(button('Rejeitar insight')).toBeDefined();
});

const period = {
  from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z', timezone: 'UTC' as const,
  observedFrom: '2026-10-01T00:00:00.000Z', partial: false, sessions: 80, pageViews: 100,
  comparison: { from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' },
};
const clickKpi = { key: 'ctaClicksPerView', label: 'Cliques em CTA / visualização', value: 0.2, previousValue: 0.1, unit: 'ratio' as const, numerator: 20, denominator: 100, definition: 'Eventos de clique divididos por visualizações; não representa visitantes únicos.' };
function insight(id: string, payload: InsightSuggestion['payload']): InsightSuggestion {
  return { id, model: 'production', kind: 'cta', riskLevel: 'low', approvedAt: null, experimentsReadyAt: null, experiments: [], expectedImpact: null, payload: { title: `Insight ${id}`, detail: 'Hipótese para testar.', ...payload } };
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

it('records approval, explains the 24-hour preparation and lists delivered approved experiments after a read refresh', async () => {
  const item = insight('actionable', { experimentProposals: [
    { name: 'Texto do botão', selector: '#cta', proposedValue: 'Conhecer planos' },
    { name: 'Título principal', selector: '#title', proposedValue: 'Resultado esperado' },
  ], kpis: [clickKpi] });
  vi.mocked(api.get).mockResolvedValue([item]);
  let complete: (value: unknown) => void = () => {};
  vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  await act(async () => root.render(React.createElement(InsightsPage)));
  const approve = button('Aprovar insight');
  await act(async () => { approve.click(); });
  expect(approve.disabled).toBe(true);
  expect(approve.textContent).toContain('Aprovando insight');
  expect(host.textContent).toContain('os experimentos serão preparados em até 24 horas');
  approve.click(); expect(api.post).toHaveBeenCalledExactlyOnceWith('/ai/suggestions/actionable/approve');
  await act(async () => complete({ approvedAt: '2026-11-21T12:00:00Z', experimentsReadyAt: null, experiments: [] }));
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Insight aprovado'));
  expect(host.textContent).toContain('Seus experimentos estão sendo preparados');
  expect(host.textContent).toContain('já aprovados e prontos para iniciar');
  expect(host.querySelector('section[aria-label="Experimentos deste insight"]')).toBeNull();
  vi.mocked(api.get).mockResolvedValue([{ ...item, approvedAt: '2026-11-21T12:00:00Z', experimentsReadyAt: '2026-11-21T13:00:00Z', experiments: [
    { id: 'first', name: 'Texto do botão', status: 'approved' },
    { id: 'second', name: 'Título principal', status: 'approved' },
  ] }]);
  await act(async () => button('Atualizar situação').click());
  expect(button('Aprovar insight')).toBeUndefined();
  expect(host.querySelector('a[href="/experiments?review=first"]')?.textContent).toBe('Texto do botão');
  expect(host.querySelector('a[href="/experiments?review=second"]')?.textContent).toBe('Título principal');
  expect(host.querySelector('a[href="/experiments"]')).not.toBeNull();
  expect(host.querySelector('a[href*="/experiments?insight="]')).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenCalledOnce();
});

it('can approve an informational insight for later preparation without inventing immediate experiments', async () => {
  vi.mocked(api.get).mockResolvedValue([insight('informational', { kpis: [clickKpi] })]);
  vi.mocked(api.post).mockResolvedValue({ approvedAt: '2026-11-21T12:00:00Z', experimentsReadyAt: null, experiments: [] });
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.textContent).toContain('os experimentos serão preparados em até 24 horas');
  await act(async () => button('Aprovar insight').click());
  expect(host.textContent).toContain('Seus experimentos estão sendo preparados');
  expect(host.querySelector('section[aria-label="Experimentos deste insight"]')).toBeNull();
});

it('keeps a failed approval pending and allows another attempt', async () => {
  vi.mocked(api.get).mockResolvedValue([insight('pending', { selector: '#cta', proposedValue: 'Novo texto' })]);
  vi.mocked(api.post).mockRejectedValue(new Error('Sem conexão'));
  await act(async () => root.render(React.createElement(InsightsPage)));
  await act(async () => button('Aprovar insight').click());
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Não foi possível concluir a ação'));
  expect(host.textContent).not.toContain('Sem conexão');
  expect(host.textContent).toContain('Aguardando aprovação');
  expect(button('Aprovar insight').disabled).toBe(false);
});

it('loads a linked insight directly even when it would be outside the latest results', async () => {
  state.insightId = 'origin';
  vi.mocked(api.get).mockResolvedValue([{ ...insight('origin', {}), approvedAt: '2026-11-21T12:00:00Z', experimentsReadyAt: '2026-11-21T13:00:00Z', experiments: [{ id: 'experiment', name: 'Experimento do insight', status: 'approved' }] }]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(api.get).toHaveBeenCalledWith('/sites/site/ai/suggestions?insightId=origin');
  expect(host.textContent).toContain('Experimento do insight');
  expect(host.querySelector('a[href="/insights"]')?.textContent).toBe('Ver todos os insights');
});

it('does not offer manual insight generation to editors', async () => {
  state.role = 'editor';
  vi.mocked(api.get).mockResolvedValue([insight('pending', {})]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(button('Aprovar insight')).toBeDefined(); expect(button('Rejeitar insight')).toBeDefined();
  expect(host.textContent).not.toContain('Gerar insights');
  expect(host.textContent).not.toContain('Run Analysis');
  expect(api.post).not.toHaveBeenCalled();
});

it('lets viewers inspect evidence without exposing experiment creation', async () => {
  state.role = 'viewer';
  vi.mocked(api.get).mockResolvedValue([insight('read-only', { selector: '#cta', proposedValue: 'Conhecer planos', kpis: [clickKpi] })]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.querySelector('details')).not.toBeNull();
  expect(button('Aprovar insight')).toBeUndefined(); expect(button('Rejeitar insight')).toBeUndefined();
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

it('keeps the hypothesis, status and risk on the collapsed face and expands evidence', async () => {
  vi.mocked(api.get).mockResolvedValue([insight('accordion', { kpis: [clickKpi] })]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  const accordion = host.querySelector('details')!;
  const summary = accordion.querySelector('summary')!;
  expect(accordion.open).toBe(false);
  expect(summary.querySelector('h2')?.textContent).toBe('Insight accordion');
  expect(summary.textContent).toContain('Hipótese para testar.');
  expect(summary.textContent).toContain('Aguardando aprovação');
  expect(summary.textContent).toContain('Risco baixo');
  expect(summary.querySelector('svg')).not.toBeNull();
  expect(summary.querySelector('button')).toBeNull();
  summary.click();
  expect(accordion.open).toBe(true);
  expect(accordion.querySelector('dl[aria-label="KPIs relacionados"]')).not.toBeNull();
  expect(accordion.contains(button('Aprovar insight'))).toBe(false);
});

it('confirms rejection in the UI, prevents duplicate submissions and keeps a rejected card inspectable', async () => {
  vi.mocked(api.get).mockResolvedValue([insight('reject-me', { kpis: [clickKpi] })]);
  let resolve: (value: unknown) => void = () => {};
  vi.mocked(api.post).mockImplementation(() => new Promise(done => { resolve = done; }));
  await act(async () => root.render(React.createElement(InsightsPage)));
  await act(async () => button('Rejeitar insight').click());
  expect(document.activeElement).toBe(button('Cancelar'));
  expect(api.post).not.toHaveBeenCalled();
  await act(async () => button('Cancelar').click());
  expect(button('Confirmar rejeição')).toBeUndefined();
  await act(async () => button('Rejeitar insight').click());
  const confirm = button('Confirmar rejeição');
  await act(async () => { confirm.click(); confirm.click(); });
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/ai/suggestions/reject-me/reject');
  expect(confirm.disabled).toBe(true);
  await act(async () => resolve({ rejectedAt: '2026-11-21T13:00:00Z' }));
  expect(host.querySelector('summary')?.textContent).toContain('Insight rejeitado');
  expect(button('Aprovar insight')).toBeUndefined();
  expect(button('Rejeitar insight')).toBeUndefined();
  expect(host.querySelector('details')).not.toBeNull();
});

it('does not show a failed rejection as successful and allows a retry', async () => {
  vi.mocked(api.get).mockResolvedValue([insight('retry', {})]);
  vi.mocked(api.post).mockRejectedValue(new Error('Database internal error'));
  await act(async () => root.render(React.createElement(InsightsPage)));
  await act(async () => button('Rejeitar insight').click());
  await act(async () => button('Confirmar rejeição').click());
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Tente novamente'));
  expect(host.textContent).not.toContain('Database internal error');
  expect(button('Confirmar rejeição').disabled).toBe(false);
  expect(host.querySelector('summary')?.textContent).toContain('Aguardando aprovação');
});

it('filters accepted, preparing and rejected insights without making extra requests', async () => {
  vi.mocked(api.get).mockResolvedValue([
    insight('pending', {}),
    { ...insight('preparing', {}), approvedAt: '2026-11-21T12:00:00Z' },
    { ...insight('ready', {}), approvedAt: '2026-11-20T12:00:00Z', experimentsReadyAt: '2026-11-21T12:00:00Z' },
    { ...insight('rejected', {}), rejectedAt: '2026-11-21T12:00:00Z' },
  ]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  const shown = () => [...host.querySelectorAll('h2')].map(node => node.textContent);
  const filter = (label: string) => [...host.querySelectorAll('[aria-pressed]')].find(node => node.textContent?.startsWith(label)) as HTMLButtonElement;
  await act(async () => filter('Aceitos').click());
  expect(shown()).toEqual(['Insight preparing', 'Insight ready']);
  expect(filter('Aceitos').getAttribute('aria-pressed')).toBe('true');
  const notice = host.querySelector('#insight-preparing > div')!;
  expect(notice.textContent).toContain('Seus experimentos estão sendo preparados');
  expect(host.querySelector('#insight-preparing details')?.contains(notice)).toBe(false);
  await act(async () => filter('Experimentos sendo gerados').click());
  expect(shown()).toEqual(['Insight preparing']);
  await act(async () => filter('Rejeitados').click());
  expect(shown()).toEqual(['Insight rejected']);
  expect(button('Aprovar insight')).toBeUndefined();
  await act(async () => filter('Todos os status').click());
  expect(shown()).toHaveLength(4);
  expect(api.get).toHaveBeenCalledOnce();
});

it('shows a distinct empty filter and keeps the status controls available', async () => {
  vi.mocked(api.get).mockResolvedValue([insight('pending', {})]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  await act(async () => ([...host.querySelectorAll('[aria-pressed]')].find(node => node.textContent?.startsWith('Rejeitados')) as HTMLButtonElement).click());
  expect(host.textContent).toContain('Nenhum insight neste status');
  expect(host.querySelector('[aria-label="Filtrar insights por status"]')).not.toBeNull();
});

it('discards a previous site read when the selected site changes', async () => {
  let resolve: (value: unknown) => void = () => {};
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValueOnce([insight('new-site', {})]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  state.siteId = 'new-site';
  await act(async () => root.render(React.createElement(InsightsPage)));
  await act(async () => resolve([insight('old-site', {})]));
  expect(host.textContent).toContain('Insight new-site');
  expect(host.textContent).not.toContain('Insight old-site');
  expect(api.get).toHaveBeenLastCalledWith('/sites/new-site/ai/suggestions');
});

vi.mock('../src/components/ui/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
