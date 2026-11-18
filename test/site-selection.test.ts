import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionContext } from '../src/lib/session';
import { SitesProvider, useSites } from '../src/lib/use-sites';
import { SiteScope } from '../src/components/site-navigation';
import InsightsPage from '../src/app/(dashboard)/insights/page';
import { api, type Site } from '../src/lib/api';

vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }));
vi.mock('next/navigation', () => ({ usePathname: () => '/insights', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
const sites = [{ id: 'a', name: 'Site A' }, { id: 'b', name: 'Site B' }] as Site[];
const user = { id: 'user', tenantId: 'tenant', name: 'User', email: 'user@example.com', role: 'viewer' as const };
let host: HTMLDivElement, root: Root;
function Controls() {
  const { siteId, selectSite, favoriteSiteId, setFavorite, preferenceError } = useSites();
  return React.createElement('div', null,
    React.createElement('output', { id: 'selected' }, siteId), React.createElement('output', { id: 'favorite' }, favoriteSiteId),
    React.createElement('button', { onClick: () => selectSite('a') }, 'Select A'),
    React.createElement('button', { onClick: () => selectSite('b') }, 'Select B'),
    React.createElement('button', { onClick: () => selectSite('foreign') }, 'Select foreign'),
    React.createElement('button', { onClick: () => { void setFavorite('a'); } }, 'Favorite A'),
    React.createElement('p', { role: 'alert' }, preferenceError));
}
function App({ account = user, children }: { account?: typeof user; children?: React.ReactNode }) {
  return React.createElement(SessionContext.Provider, { value: account }, React.createElement(SitesProvider, null, React.createElement(Controls), children));
}
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(button => button.textContent === label)!;
  await act(async () => button.click());
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); root = createRoot(host);
  vi.mocked(api.get).mockImplementation(async path => path === '/sites' ? sites : { favoriteSiteId: 'b' });
});
afterEach(async () => { await act(async () => root.unmount()); vi.resetAllMocks(); });

describe('shared site context', () => {
  it('starts with the account favorite, preserves manual selection across page changes and resets for another account', async () => {
    await act(async () => root.render(React.createElement(App)));
    expect(host.querySelector('#selected')?.textContent).toBe('b');
    await click('Select A');
    await act(async () => root.render(React.createElement(App, null, React.createElement('p', null, 'Another page'))));
    expect(host.querySelector('#selected')?.textContent).toBe('a');
    await click('Select foreign');
    expect(host.querySelector('#selected')?.textContent).toBe('a');
    await act(async () => root.render(React.createElement(App, { account: { ...user, id: 'another-user' } })));
    expect(host.querySelector('#selected')?.textContent).toBe('b');
  });
  it('replaces one favorite through the account API and preserves it when a save fails', async () => {
    await act(async () => root.render(React.createElement(App)));
    vi.mocked(api.put).mockResolvedValue({ favoriteSiteId: 'a' });
    await click('Favorite A');
    expect(api.put).toHaveBeenCalledWith('/auth/preferences', { favoriteSiteId: 'a' });
    expect(host.querySelector('#favorite')?.textContent).toBe('a');
    vi.mocked(api.put).mockRejectedValue(new Error('offline'));
    await click('Favorite A');
    expect(host.querySelector('#favorite')?.textContent).toBe('a');
    expect(host.textContent).toContain('Sua preferência anterior foi mantida');
  });
  it('falls back safely when a saved favorite is no longer available', async () => {
    vi.mocked(api.get).mockImplementation(async path => path === '/sites' ? sites : { favoriteSiteId: 'removed-site' });
    await act(async () => root.render(React.createElement(App)));
    expect(host.querySelector('#selected')?.textContent).toBe('a');
    expect(host.querySelector('#favorite')?.textContent).toBe('');
  });
  it('discards pending insights from the previous site on a context switch', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    vi.mocked(api.get).mockImplementation(path => {
      if (path === '/sites') return Promise.resolve(sites);
      if (path === '/auth/preferences') return Promise.resolve({ favoriteSiteId: 'a' });
      if (path === '/sites/a/ai/suggestions') return new Promise(resolve => { resolveOld = resolve; });
      return Promise.resolve([{ id: 'b-insight', payload: { title: 'Insight for B' } }]);
    });
    await act(async () => root.render(React.createElement(App, null, React.createElement(SiteScope, null, React.createElement(InsightsPage)))));
    await click('Select B');
    expect(host.textContent).toContain('Insight for B');
    await act(async () => resolveOld([{ id: 'old', payload: { title: 'Stale insight for A' } }]));
    expect(host.textContent).not.toContain('Stale insight for A');
    expect(host.textContent).toContain('Insight for B');
  });
});
