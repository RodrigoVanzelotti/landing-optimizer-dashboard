import { toast } from '../src/components/ui/toast';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionContext } from '../src/lib/session';
import { SitesProvider, useSites } from '../src/lib/use-sites';
import { SiteNavigation, SiteScope } from '../src/components/site-navigation';
import { Sidebar } from '../src/components/sidebar';
import InsightsPage from '../src/app/(dashboard)/insights/page';
import { api, type Site } from '../src/lib/api';

vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }));
const navigation = vi.hoisted(() => ({ pathname: '/insights', push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname, useSearchParams: () => new URLSearchParams(), useRouter: () => navigation }));
const sites = [{ id: 'a', name: 'Site A', primaryDomain: 'a.example.com' }, { id: 'b', name: 'Site B', primaryDomain: 'b.example.com' }] as Site[];
const user = { id: 'user', tenantId: 'tenant', name: 'User', email: 'user@example.com', role: 'viewer' as const };
let host: HTMLDivElement, root: Root;
function Controls() {
  const { siteId, selectSite, favoriteSiteId, setFavorite, preferenceError, removeSite, reload } = useSites();
  return React.createElement('div', null,
    React.createElement('output', { id: 'selected' }, siteId), React.createElement('output', { id: 'favorite' }, favoriteSiteId),
    React.createElement('button', { onClick: () => selectSite('a') }, 'Select A'),
    React.createElement('button', { onClick: () => selectSite('b') }, 'Select B'),
    React.createElement('button', { onClick: () => selectSite('foreign') }, 'Select foreign'),
    React.createElement('button', { onClick: () => { void setFavorite('a'); } }, 'Favorite A'),
    React.createElement('button', { onClick: () => removeSite('a') }, 'Remove A'),
    React.createElement('button', { onClick: () => removeSite('b') }, 'Remove B'),
    React.createElement('button', { onClick: reload }, 'Reload'),
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
  navigation.pathname = '/insights';
  vi.mocked(api.get).mockImplementation(async path => path === '/sites' ? sites : { favoriteSiteId: 'b' });
});
afterEach(async () => { await act(async () => root.unmount()); vi.resetAllMocks(); });

describe('shared site context', () => {
  it('removes a selected favorite immediately, chooses a remaining site and tolerates deleting the last site', async () => {
    await act(async () => root.render(React.createElement(App)));
    await click('Remove B');
    expect(host.querySelector('#favorite')?.textContent).toBe('');
    expect(host.querySelector('#selected')?.textContent).toBe('a');
    await click('Reload'); // Even stale server/list responses cannot restore a locally deleted site.
    expect(host.querySelector('#favorite')?.textContent).toBe('');
    expect(host.querySelector('#selected')?.textContent).toBe('a');
    await click('Remove A');
    expect(host.querySelector('#selected')?.textContent).toBe('');
  });
  it('places one labelled selector inside the sidebar and retains selection when navigating', async () => {
    await act(async () => root.render(React.createElement(App, null, React.createElement(Sidebar))));
    const select = host.querySelector<HTMLSelectElement>('#active-site')!;
    expect(select.closest('aside')).not.toBeNull();
    expect(host.querySelector('label[for="active-site"]')?.textContent).toBe('Site ativo');
    expect(select.value).toBe('b');
    expect(host.querySelector('aside')?.textContent).toContain('b.example.com');
    await act(async () => { select.value = 'a'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    navigation.pathname = '/experiments';
    await act(async () => root.render(React.createElement(App, null, React.createElement(Sidebar))));
    expect(host.querySelectorAll('#active-site')).toHaveLength(1);
    expect(host.querySelector<HTMLSelectElement>('#active-site')?.value).toBe('a');
    expect(host.querySelector('aside')?.textContent).toContain('a.example.com');
    expect(host.querySelector('#favorite')?.textContent).toBe('b');
  });
  it.each(['/settings', '/tenants'])('hides the selector in %s and restores the same site afterwards', async pathname => {
    await act(async () => root.render(React.createElement(App, null, React.createElement(Sidebar))));
    await click('Select A');
    navigation.pathname = pathname;
    await act(async () => root.render(React.createElement(App, null, React.createElement(Sidebar))));
    expect(host.querySelector('#active-site')).toBeNull();
    navigation.pathname = '/insights';
    await act(async () => root.render(React.createElement(App, null, React.createElement(Sidebar))));
    expect(host.querySelector<HTMLSelectElement>('#active-site')?.value).toBe('a');
  });
  it('keeps the selector visible on the Sites list', async () => {
    navigation.pathname = '/sites';
    await act(async () => root.render(React.createElement(App, null, React.createElement(Sidebar))));
    expect(host.querySelector<HTMLSelectElement>('#active-site')?.value).toBe('b');
  });
  it('selects an installation link site and navigates to the new installation when switched', async () => {
    navigation.pathname = '/sites/a';
    await act(async () => root.render(React.createElement(App, null, React.createElement(Sidebar))));
    const select = host.querySelector<HTMLSelectElement>('#active-site')!;
    expect(select.value).toBe('a');
    expect(host.querySelector('#selected')?.textContent).toBe('a');
    await act(async () => { select.value = 'b'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(navigation.push).toHaveBeenCalledWith('/sites/b');
  });
  it('keeps load failures recoverable in the sidebar', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));
    await act(async () => root.render(React.createElement(App, null, React.createElement(Sidebar))));
    expect(host.querySelector<HTMLSelectElement>('#active-site')?.disabled).toBe(true);
    expect(host.querySelector('aside [role="alert"]')?.textContent).toContain('Não foi possível carregar os sites');
    await click('Tentar novamente');
    expect(host.querySelector<HTMLSelectElement>('#active-site')?.disabled).toBe(false);
  });
  it('clears the origin insight filter when selecting a different site', async () => {
    await act(async () => root.render(React.createElement(App, null, React.createElement(SiteNavigation))));
    const select = host.querySelector<HTMLSelectElement>('#active-site')!;
    await act(async () => { select.value = 'a'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(navigation.replace).toHaveBeenCalledWith('/insights');
  });
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
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Sua preferência anterior foi mantida'));
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

vi.mock('../src/components/ui/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
