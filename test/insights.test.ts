import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import InsightsPage from '../src/app/(dashboard)/insights/page';
import { api } from '../src/lib/api';

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
    { ...suggestion, id: 'demo-title', payload: { title: '[MOCK] Exemplo' } },
    suggestion,
  ]);
  await act(async () => root.render(React.createElement(InsightsPage)));
  expect(host.textContent).toContain('Insight real');
  expect(host.textContent).not.toContain('Resultado de demonstração');
  expect(host.textContent).not.toContain('[MOCK]');
  expect([...host.querySelectorAll('button')].map(button => button.textContent?.trim())).toEqual(['Criar experimento']);
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
