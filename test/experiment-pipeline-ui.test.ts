import * as React from 'react';
import './dialog-mock';
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
const session = vi.hoisted(() => ({ role: 'editor' }));
vi.mock('../src/lib/session', () => ({ useSession: () => ({ role: session.role }) }));
vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
let host: HTMLDivElement, root: Root;
let items: Experiment[];
const base: Experiment = { id: 'approved', name: 'Título aprovado', siteId: 'site', insightId: 'origin', status: 'approved', type: 'headline', riskScore: 15, allocation: 0.5, createdAt: '2026-11-20T12:00:00Z' };
beforeEach(() => {
  session.role = 'editor';
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
    if (path.startsWith('/experiments?')) return [...items];
    if (path.startsWith('/sites/site/ai/suggestions?')) return [{ id: 'origin', payload: { title: 'Insight de origem' } }];
    if (path === '/sites/site/goals') return [];
    if (path.startsWith('/analytics/experiments/results?')) return items.map(experiment => ({ experimentId: experiment.id, experiment, goal: null, variants: [] }));
    if (path.startsWith('/analytics/experiments/')) return { variants: [] };
    return { ...items.find(item => path === `/experiments/${item.id}`), primaryGoalId: null, variants: [] };
  });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(HTMLElement.prototype, 'animate'); });
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

it('renders the six pipeline stages in order with correct cards and a direct results link', async () => {
  await render();
  expect([...host.querySelectorAll('[aria-label="Pipeline de experimentos"] section > header h2')].map(heading => heading.textContent)).toEqual(['Aguardando aprovação', 'Em experimentação', 'Resultados disponíveis', 'Mudanças aceitas', 'Negados', 'Vencidos']);
  for (const [stage, name] of [['waiting', 'Título aprovado'], ['running', 'Texto em teste'], ['results', 'Teste concluído'], ['expired', 'Proposta vencida'], ['rejected', 'Proposta negada']]) {
    expect(host.querySelector(`[aria-labelledby="stage-${stage}"] h3`)?.textContent).toBe(name);
  }
  expect(host.querySelector('[aria-labelledby="stage-waiting"]')?.textContent).toContain('Aprovado · Pronto para iniciar');
  expect(host.querySelector('a[href="/results?experiment=completed"]')).not.toBeNull();
});

it.each(['completed', 'rolled_back', 'killed'])('shows the main KPI inside the open %s card and links to its full result', async status => {
  items[2] = { ...items[2], status };
  const initial = vi.mocked(api.get).getMockImplementation()!;
  const control = { variantId: 'control', name: 'Controle', isControl: true, exposures: 1000, conversions: 100, conversionRate: .1, lift: null, pValue: null, significant: false };
  vi.mocked(api.get).mockImplementation(path => path.endsWith('/report') ? Promise.resolve({ series: [], evidence: [], plan: null, coverageComplete: true, conclusive: true, conversionWindowHours: 24, recordedAt: '2026-11-21T12:00:00Z', experimentId: 'completed', experiment: items[2], goal: { id: 'goal', name: 'Leads confirmados' }, variants: [control, { ...control, variantId: 'variant', name: 'Variação B', isControl: false, conversions: 150, conversionRate: .15, lift: .5, pValue: .001, significant: true }] }) : initial(path));
  window.history.replaceState(null, '', '/experiments?review=completed');
  await render();
  const summary = host.querySelector('dialog [aria-label="Resultado principal"]')!;
  expect(summary.textContent).toContain('Leads confirmados');
  expect(summary.textContent).toContain('+50%');
  expect(summary.textContent).toContain('10%');
  expect(summary.textContent).toContain('15%');
  expect(summary.textContent).toContain('Melhora significativa');
  expect(summary.textContent).toContain('Mudança proposta');
  expect(summary.querySelector('a')?.getAttribute('href')).toBe('/results?experiment=completed');
  expect(summary.querySelector('a')?.textContent).toBe('Ver mais');
  expect(summary.compareDocumentPosition(host.querySelector('dialog [aria-label="Hipótese"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('loads result KPIs only when a results card is opened and preserves them on reopening', async () => {
  await render();
  expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/report'));
  await act(async () => host.querySelector<HTMLAnchorElement>('#card-completed')!.click());
  expect(host.querySelector('dialog [aria-label="Resultado principal"]')?.textContent).toContain('Resultado ainda indisponível');
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Fechar detalhes do experimento"]')!.click());
  await act(async () => host.querySelector<HTMLAnchorElement>('#card-completed')!.click());
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => path.endsWith('/report'))).toHaveLength(1);
});

it('distinguishes failed result reads from unavailable data and permits retry', async () => {
  const initial = vi.mocked(api.get).getMockImplementation()!;
  let fail = true;
  vi.mocked(api.get).mockImplementation(path => path.endsWith('/report') ? fail ? Promise.reject(new Error('Offline')) : Promise.resolve({ variants: [] }) : initial(path));
  window.history.replaceState(null, '', '/experiments?review=completed');
  await render();
  const summary = host.querySelector('[aria-label="Resultado principal"]')!;
  expect(summary.textContent).toContain('Não foi possível carregar o resultado');
  expect(summary.textContent).not.toContain('Resultado ainda indisponível');
  fail = false;
  await act(async () => summary.querySelector('button')!.click());
  expect(summary.textContent).toContain('Resultado ainda indisponível');
  expect(summary.textContent).not.toContain('Não foi possível carregar o resultado');
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
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] section')).toHaveLength(6);
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

it('hides the control card while preserving proposed variant changes', async () => {
  const initial = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(path => path === '/experiments/approved' ? Promise.resolve({ ...base, primaryGoalId: null, variants: [
    { id: 'control', name: 'Controle', isControl: true, weight: 0.5, changes: [] },
    { id: 'variant', name: 'Nova chamada', isControl: false, weight: 0.5, changes: [{ id: 'change', selector: 'h1', op: 'text', originalValue: 'Antes', proposedValue: 'Depois' }] },
  ] }) : initial(path));
  window.history.replaceState(null, '', '/experiments?review=approved');
  await render();
  const detail = host.querySelector('[aria-label="Detalhes de Título aprovado"]')!;
  expect(detail.textContent).not.toContain('Controle');
  expect(detail.textContent).not.toContain('Sem alterações: esta é a referência do teste.');
  expect(detail.textContent).toContain('Mudança proposta');
  expect(detail.textContent).toContain('Depois');
});

it.each(['admin', 'editor'])('lets %s approve and start a draft in one action', async role => {
  session.role = role;
  items[0] = { ...base, status: 'draft' };
  vi.mocked(api.post).mockImplementation(async path => {
    items[0] = { ...items[0], status: path.endsWith('/submit') ? 'pending_review' : path.endsWith('/start') ? 'running' : 'approved' };
    return items[0];
  });
  window.history.replaceState(null, '', '/experiments?review=approved');
  await render();
  const modal = host.querySelector<HTMLDialogElement>('#experiment-dialog')!;
  const approve = [...modal.querySelectorAll('button')].find(button => button.textContent === 'Aprovar e iniciar')!;
  expect(approve.title).toContain('será publicada');
  expect(modal.textContent).not.toContain('Enviar para revisão');
  expect([...modal.querySelectorAll('button')].some(button => button.textContent === 'Negar')).toBe(true);
  await act(async () => approve.click());
  expect(vi.mocked(api.post).mock.calls.map(([path]) => path)).toEqual(['/experiments/approved/submit', '/experiments/approved/approve', '/experiments/approved/start']);
  expect(modal.querySelector('[aria-label="Estado do experimento"]')?.textContent).toBe('Em experimentação');
  expect(host.querySelector('[aria-labelledby="stage-running"] #card-approved')).not.toBeNull();
});

it.each(['ai_suggested', 'pending_review'])('offers approve and deny for %s and only submits when needed', async status => {
  items[0] = { ...base, status };
  window.history.replaceState(null, '', '/experiments?review=approved');
  await render();
  const approve = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === 'Aprovar e iniciar')!;
  await act(async () => approve.click());
  expect(api.post).toHaveBeenCalledWith('/experiments/approved/approve', expect.any(Object));
  expect(api.post).toHaveBeenCalledWith('/experiments/approved/start');
  expect(vi.mocked(api.post).mock.calls.some(([path]) => path.endsWith('/submit'))).toBe(status === 'ai_suggested');
});

it('does not resubmit a draft when approval fails after submission', async () => {
  items[0] = { ...base, status: 'draft' };
  vi.mocked(api.post).mockImplementationOnce(async () => { items[0] = { ...items[0], status: 'pending_review' }; return {}; }).mockRejectedValueOnce(new Error('Sem conexão')).mockResolvedValue({});
  window.history.replaceState(null, '', '/experiments?review=approved');
  await render();
  const approve = () => [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === 'Aprovar e iniciar')!;
  await act(async () => approve().click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível concluir a ação agora');
  await act(async () => approve().click());
  expect(vi.mocked(api.post).mock.calls.map(([path]) => path)).toEqual(['/experiments/approved/submit', '/experiments/approved/approve', '/experiments/approved/approve', '/experiments/approved/start']);
});

it('keeps the actual approved state and retries only starting when the start request fails', async () => {
  items[0] = { ...base, status: 'pending_review' };
  vi.mocked(api.post).mockImplementationOnce(async () => { items[0] = { ...items[0], status: 'approved' }; return {}; }).mockRejectedValueOnce(new Error('Falha ao iniciar')).mockImplementationOnce(async () => { items[0] = { ...items[0], status: 'running' }; return {}; });
  window.history.replaceState(null, '', '/experiments?review=approved');
  await render();
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === 'Aprovar e iniciar')!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível concluir a ação agora');
  expect(host.querySelector('dialog [aria-label="Estado do experimento"]')?.textContent).toBe('Aprovado · Pronto para iniciar');
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === 'Iniciar')!.click());
  expect(vi.mocked(api.post).mock.calls.map(([path]) => path)).toEqual(['/experiments/approved/approve', '/experiments/approved/start', '/experiments/approved/start']);
  expect(host.querySelector('dialog [aria-label="Estado do experimento"]')?.textContent).toBe('Em experimentação');
});

it('keeps the modal open when starting moves a card out of the selected waiting stage', async () => {
  vi.mocked(api.post).mockImplementation(async () => { items[0] = { ...items[0], status: 'running' }; return items[0]; });
  window.history.replaceState(null, '', '/experiments?stage=waiting&review=approved');
  await render();
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === 'Iniciar')!.click());
  expect(host.querySelector<HTMLDialogElement>('dialog')!.open).toBe(true);
  expect(host.querySelector('dialog [aria-label="Estado do experimento"]')?.textContent).toBe('Em experimentação');
  expect(host.textContent).not.toContain('Experimento indisponível nesta seleção');
});

it.each([false, true])('flips confirmed state changes for 500ms respecting reduced motion (%s)', async reduced => {
  const animate = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  await render();
  expect(animate).not.toHaveBeenCalled();
  items[0] = { ...items[0], status: 'running' };
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Atualizar')!.click());
  if (reduced) expect(animate).not.toHaveBeenCalled();
  else {
    expect(animate).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ transform: 'perspective(1200px) rotateX(90deg)' })]), expect.objectContaining({ duration: 500 }));
    expect(animate.mock.contexts.some(element => element instanceof HTMLElement && element.id === 'pipeline-card-approved')).toBe(true);
  }
  animate.mockClear();
  await chooseStage('Em experimentação');
  expect(animate).not.toHaveBeenCalled();
});

it.each(['admin', 'editor', 'viewer'])('enforces review actions for %s and explains denial on hover', async role => {
  session.role = role;
  items[0] = { ...base, status: 'pending_review' };
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  window.history.replaceState(null, '', '/experiments?review=approved');
  await render();
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('dialog button')];
  const deny = buttons.find(button => button.textContent === 'Negar');
  expect(Boolean(deny)).toBe(role !== 'viewer');
  expect(buttons.some(button => button.textContent === 'Aprovar e iniciar')).toBe(role !== 'viewer');
  if (deny) {
    expect(deny.title).toContain('move o experimento para Negados');
    await act(async () => deny.click());
    expect(api.post).not.toHaveBeenCalled();
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === 'Confirmar ação')!.click());
    expect(window.confirm).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/experiments/approved/reject', { reason: 'Rejeitado na revisão' });
  } else expect(api.post).not.toHaveBeenCalled();
});

it.each([
  ['approved', 'Negar', 'reject'], ['running', 'Rejeitar experimento', 'rollback'],
  ['paused', 'Rejeitar experimento', 'rollback'], ['completed', 'Reverter mudança', 'rollback'],
])('confirms %s / %s inside the UI and supports cancellation', async (status, label, action) => {
  items[0] = { ...base, status };
  window.history.replaceState(null, '', '/experiments?review=approved');
  await render();
  const button = () => [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(item => item.textContent === label)!;
  await act(async () => button().click());
  expect(api.post).not.toHaveBeenCalled();
  const cancel = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(item => item.textContent === 'Cancelar')!;
  expect(document.activeElement).toBe(cancel);
  await act(async () => cancel.click());
  expect(api.post).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(button());
  await act(async () => button().click());
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(item => item.textContent === 'Confirmar ação')!.click());
  expect(api.post).toHaveBeenCalledWith(`/experiments/approved/${action}`, action === 'reject' ? { reason: 'Rejeitado na revisão' } : undefined);
});

it('allows only pausing or rejecting a running experiment and never manually completing it', async () => {
  window.history.replaceState(null, '', '/experiments?review=running');
  await render();
  const actions = [...host.querySelectorAll('dialog button[id]')].map(button => button.textContent);
  expect(actions).toEqual(['Pausar', 'Rejeitar experimento']);
  expect(actions).not.toContain('Concluir');
});

it.each(['admin', 'editor', 'viewer'])('allows only editors/admins to confirm a chosen change for every eligible visitor (%s)', async role => {
  session.role = role;
  const initial = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(path => path === '/experiments/completed' ? Promise.resolve({ ...items[2], resultState: 'ready', primaryGoalId: null, variants: [{ id: 'proposal', name: 'Proposta', isControl: false, changes: [] }] }) : initial(path));
  vi.mocked(api.post).mockImplementation(async () => { items[2] = { ...items[2], status: 'accepted' }; return {}; });
  window.history.replaceState(null, '', '/experiments?review=completed');
  await render();
  const keep = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === 'Manter mudança');
  expect(Boolean(keep)).toBe(role !== 'viewer');
  if (!keep) return;
  await act(async () => keep.click());
  expect(host.querySelector('dialog')?.textContent).toContain('100% dos visitantes elegíveis');
  expect(api.post).not.toHaveBeenCalled();
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === 'Confirmar ação')!.click());
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/experiments/completed/accept', { variantId: 'proposal' });
  expect(host.querySelector('[aria-labelledby="stage-accepted"] #card-completed')).not.toBeNull();
});

it('keeps legacy completions without a verified snapshot out of Resultados disponíveis', async () => {
  items[2] = { ...items[2], resultState: 'pending_validation' };
  window.history.replaceState(null, '', '/experiments?review=completed');
  await render();
  expect(host.querySelector('[aria-labelledby="stage-results"] #card-completed')).toBeNull();
  expect(host.querySelector('[aria-labelledby="stage-running"] #card-completed')).not.toBeNull();
  expect(host.querySelector('dialog')?.textContent).toContain('Resultado em verificação');
  expect([...host.querySelectorAll('dialog button')].some(button => button.textContent === 'Manter mudança')).toBe(false);
});

it('places reverted experiments under Negados and accepted changes in their own stage', async () => {
  items.push({ ...base, id: 'reverted', name: 'Mudança revertida', status: 'rolled_back' }, { ...base, id: 'accepted', name: 'Mudança mantida', status: 'accepted' });
  await render();
  expect(host.querySelector('[aria-labelledby="stage-rejected"] #card-reverted')).not.toBeNull();
  expect(host.querySelector('[aria-labelledby="stage-accepted"] #card-accepted')).not.toBeNull();
  expect(host.textContent).not.toContain('Cada experimento na etapa em que está hoje.');
});

it('closes an experiment deep link to the complete pipeline including other insights', async () => {
  items[1] = { ...items[1], insightId: 'another-insight' };
  window.history.replaceState(null, '', '/experiments?review=approved');
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Fechar detalhes do experimento"]')!.click());
  expect(window.location.search).toBe('');
  expect(host.querySelectorAll('[aria-label="Pipeline de experimentos"] h3')).toHaveLength(items.length);
  expect(host.querySelector('#card-running')).not.toBeNull();
});

it('keeps expired proposals readable while hiding their editing and starting actions', async () => {
  window.history.replaceState(null, '', '/experiments?review=expired');
  await render();
  const detail = host.querySelector('[aria-label="Detalhes de Proposta vencida"]')!;
  expect(detail.textContent).toContain('Esta proposta venceu após 7 dias sem iniciar');
  expect([...detail.querySelectorAll('button')].map(button => button.textContent)).not.toContain('Iniciar');
  expect(detail.querySelector('form')).toBeNull();
});

it('opens a modal from the card and closes by X, outside click or Escape without reloading details', async () => {
  await render();
  const card = host.querySelector<HTMLAnchorElement>('#card-approved')!;
  const modal = host.querySelector<HTMLDialogElement>('#experiment-dialog')!;
  card.focus();
  await act(async () => card.click());
  expect(modal.open).toBe(true);
  expect(modal.textContent).toContain(base.name);
  expect(document.body.style.overflow).toBe('hidden');
  const close = modal.querySelector<HTMLButtonElement>('[aria-label="Fechar detalhes do experimento"]')!;
  expect(document.activeElement).toBe(close);
  await act(async () => close.click());
  expect(modal.open).toBe(false);
  expect(window.location.search).toBe('');
  expect(document.body.style.overflow).toBe('');
  expect(document.activeElement).toBe(card);
  await act(async () => card.click());
  await act(async () => modal.querySelector('section')!.click());
  expect(modal.open).toBe(true);
  await act(async () => modal.click());
  expect(modal.open).toBe(false);
  await act(async () => card.click());
  await act(async () => modal.dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(modal.open).toBe(false);
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => path === '/experiments/approved')).toHaveLength(1);
});

it('opens the modal from list cards and follows history selection changes', async () => {
  window.history.replaceState(null, '', '/experiments?view=list');
  await render();
  await act(async () => host.querySelector<HTMLAnchorElement>('#card-running')!.click());
  const modal = host.querySelector<HTMLDialogElement>('#experiment-dialog')!;
  expect(modal.open).toBe(true);
  expect(window.location.search).toContain('view=list');
  await act(async () => window.history.replaceState(null, '', '/experiments?view=list'));
  expect(modal.open).toBe(false);
  await act(async () => window.history.replaceState(null, '', '/experiments?view=list&review=running'));
  expect(modal.open).toBe(true);
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
  expect(api.get).toHaveBeenCalledWith('/analytics/experiments/results?siteId=site');
  expect(host.querySelector('#result-card-completed a[role="button"]')?.getAttribute('aria-expanded')).toBe('true');
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
  vi.mocked(api.get).mockImplementation(path => path.startsWith('/analytics/experiments/results?') ? Promise.resolve(items.map(experiment => ({ experimentId: experiment.id, experiment, goal: null, variants: [
    { variantId: 'control', name: 'Controle', isControl: true, exposures: 100, conversions: 10, conversionRate: .1, lift: null, pValue: null, significant: false },
    { variantId: 'better', name: 'Nova chamada', isControl: false, exposures: 100, conversions: 12, conversionRate: .12, lift: .2, pValue: .032, significant: true },
    { variantId: 'missing', name: 'Sem dados', isControl: false, exposures: 0, conversions: 0, conversionRate: 0, lift: null, pValue: null, significant: false },
  ] }))) : initial(path));
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
  await act(async () => host.querySelector<HTMLAnchorElement>('#result-card-approved a[role="button"]')!.click());
  expect(host.querySelector('#result-details-approved [aria-label="Insight de origem"]')).toBeNull();
  expect(host.querySelector('#result-details-approved')?.textContent).toContain('não possui um insight de IA vinculado');
});
