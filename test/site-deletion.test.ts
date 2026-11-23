import './dialog-mock';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SitesPage from '../src/app/(dashboard)/sites/page';
import { api, type Site } from '../src/lib/api';

const state = vi.hoisted(() => ({ role: 'admin', removeSite: vi.fn() }));
const site = { id: 'site', name: 'Site principal', primaryDomain: 'example.test', configVersion: 0, status: 'active' } as Site;
vi.mock('../src/lib/session', () => ({ useSession: () => ({ role: state.role }) }));
vi.mock('../src/lib/use-sites', () => ({ useSites: () => ({ sites: [site], removeSite: state.removeSite }) }));
vi.mock('../src/lib/api', () => ({ api: { del: vi.fn() } }));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.role = 'admin';
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.resetAllMocks(); });
async function click(text: string) {
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === text)!.click());
}
async function type(value: string) {
  const input = host.querySelector<HTMLInputElement>('#delete-site-confirmation')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
it.each(['viewer', 'editor'])('hides site deletion from %s', async role => {
  state.role = role; await act(async () => root.render(React.createElement(SitesPage)));
  expect(host.querySelector('button[aria-label^="Excluir site"]')).toBeNull();
});
it('requires the exact domain, communicates irreversible consequences and prevents cancelling or duplicate deletion in flight', async () => {
  let finish!: () => void;
  vi.mocked(api.del).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  await act(async () => root.render(React.createElement(SitesPage)));
  await click('Excluir');
  expect(host.querySelector('dialog')?.textContent).toContain('tokens de ingestão');
  expect(host.querySelector('dialog')?.textContent).toContain('somente o administrador');
  const submit = host.querySelector<HTMLButtonElement>('dialog button[type="submit"]')!;
  await type('https://example.test'); expect(submit.disabled).toBe(true);
  await type('example.test'); expect(submit.disabled).toBe(false);
  await click('Excluir site e todos os dados');
  expect(api.del).toHaveBeenCalledExactlyOnceWith('/sites/site', { confirmation: 'example.test' });
  expect(submit.disabled).toBe(true);
  expect(host.querySelector<HTMLButtonElement>('dialog button[type="button"]')?.disabled).toBe(true);
  await act(async () => host.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(host.querySelector('dialog')).not.toBeNull();
  await act(async () => finish());
  expect(state.removeSite).toHaveBeenCalledExactlyOnceWith('site');
  expect(host.querySelector('dialog')).toBeNull();
  expect(host.textContent).toContain('Site e dados excluídos');
});
it('preserves the confirmation after a failure and allows cancelling without deleting', async () => {
  vi.mocked(api.del).mockRejectedValue(new Error('internal database details'));
  await act(async () => root.render(React.createElement(SitesPage)));
  await click('Excluir'); await type('example.test'); await click('Excluir site e todos os dados');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('parcialmente concluída');
  expect(host.textContent).not.toContain('internal database details');
  expect(host.querySelector<HTMLInputElement>('#delete-site-confirmation')?.value).toBe('example.test');
  expect(state.removeSite).not.toHaveBeenCalled();
  await click('Cancelar'); expect(host.querySelector('dialog')).toBeNull();
});
