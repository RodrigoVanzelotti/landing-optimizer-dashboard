import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuditSettings } from '../src/components/audit-settings';
import { SessionContext } from '../src/lib/session';
import { api } from '../src/lib/api';

vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), getBlob: vi.fn() } }));
let root: Root, host: HTMLDivElement;
const rows = Array.from({ length: 10 }, (_, i) => ({ id: String(i), action: 'site.created', actor: { kind: 'system' }, targetType: 'site', targetId: 'site', targetLabel: 'Site', createdAt: '2026-11-18T10:00:00Z' }));
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); root = createRoot(host);
  vi.mocked(api.get).mockImplementation(async path => path === '/audit/options' ? { authors: [], actions: ['site.created'] } : { items: rows, nextCursor: '9', range: { from: null, to: '2026-11-18T12:00:00Z' } });
});
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); vi.resetAllMocks(); });
async function render() {
  await act(async () => root.render(React.createElement(SessionContext.Provider, { value: { id: 'user', tenantId: 'tenant', role: 'admin', email: 'user@example.com', name: 'User' } }, React.createElement(AuditSettings))));
}
async function click(text: string) {
  await act(async () => {
    const button = [...host.querySelectorAll('button')].find(button => button.textContent === text)!;
    if (button.type === 'submit' && button.form) button.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    else button.click();
  });
}

it('loads ten all-time activities immediately, with visible optional filters and cursor pagination', async () => {
  await render();
  expect(api.get).toHaveBeenCalledWith('/audit/search?timeframe=all&order=desc');
  expect(host.querySelectorAll('ol > li')).toHaveLength(10);
  expect(host.querySelectorAll('#audit-filters select')).toHaveLength(4);
  expect(host.textContent).not.toContain('Filtrar atividades');
  await click('Próxima');
  expect(api.get).toHaveBeenLastCalledWith('/audit/search?timeframe=all&order=desc&cursor=9');
  expect(host.textContent).toContain('Página 2');
});

it('exports applied filters across all pages, without silently applying draft changes', async () => {
  const createUrl = vi.fn(() => 'blob:csv');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.mocked(api.getBlob).mockResolvedValue(new Blob(['csv'], { type: 'text/csv' }));
  await render(); await click('Próxima');
  const select = host.querySelector<HTMLSelectElement>('#audit-action')!;
  await act(async () => { select.value = 'site.created'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await click('Baixar CSV');
  expect(api.getBlob).toHaveBeenLastCalledWith('/audit/export?timeframe=all&order=desc');
  await click('Consultar atividades');
  expect(host.textContent).toContain('Página 1');
  await click('Baixar CSV');
  expect(api.getBlob).toHaveBeenLastCalledWith('/audit/export?timeframe=all&action=site.created&order=desc');
  await click('Limpar filtros');
  expect(select.value).toBe('');
});

it('keeps filter controls and results available if filter options fail', async () => {
  vi.mocked(api.get).mockImplementation(async path => { if (path === '/audit/options') throw new Error('offline'); return { items: rows, nextCursor: null, range: { from: null, to: '2026-11-18T12:00:00Z' } }; });
  await render();
  expect(host.querySelectorAll('#audit-filters select')).toHaveLength(4);
  expect(host.querySelectorAll('ol > li')).toHaveLength(10);
  expect(host.textContent).toContain('Não foi possível carregar as opções');
});
