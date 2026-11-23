import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SiteInstallPage from '../src/app/(dashboard)/sites/[id]/page';
import SitesPage from '../src/app/(dashboard)/sites/page';
import { api } from '../src/lib/api';

const state = vi.hoisted(() => ({
  role: 'admin', siteId: 'site', version: 0, reload: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: state.siteId }) }));
vi.mock('../src/lib/session', () => ({ useSession: () => ({ role: state.role }) }));
vi.mock('../src/lib/use-sites', () => ({ useSites: () => ({
  sites: [{ id: state.siteId, name: 'Site', configVersion: state.version, status: 'active' }], reload: state.reload,
}) }));
vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../src/components/goals-manager', () => ({ GoalsManager: ({ onChanged }: { onChanged: () => void }) => React.createElement('section', { id: 'goals' }, React.createElement('button', { onClick: onChanged }, 'Salvar meta')) }));

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.role = 'admin'; state.siteId = 'site'; state.version = 0;
  host = document.createElement('div'); root = createRoot(host);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.mocked(api.get).mockResolvedValue({ html: '<script></script>', csp: { scriptSrc: 'https://cdn.example.com', connectSrc: ['https://events.example.com'] } });
});
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); vi.resetAllMocks(); });

function publishButton() {
  return host.querySelector<HTMLButtonElement>('section[aria-label="Publicação da configuração"] button')!;
}

async function confirmPublication() {
  await act(async () => host.querySelector<HTMLButtonElement>('#publish-confirmation button:last-child')!.click());
}

it('shows the site version and status in Portuguese', async () => {
  await act(async () => root.render(React.createElement(SitesPage)));
  expect(host.textContent).toContain('Versão 0: ATIVO');
});

it('places publication after goals and the collapsed CSP section last, without Google Tag Manager', async () => {
  await act(async () => root.render(React.createElement(SiteInstallPage)));
  expect(host.textContent).not.toContain('Google Tag Manager');
  const publication = host.querySelector('section[aria-label="Publicação da configuração"]')!;
  const csp = host.querySelector('details')!;
  expect(host.querySelector('#goals')!.compareDocumentPosition(publication) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(publication.nextElementSibling).toBe(csp);
  expect(csp.open).toBe(false);
  csp.querySelector('summary')!.click();
  expect(csp.open).toBe(true);
});

it('confirms publication, refreshes the list and resets feedback when switching sites', async () => {
  await act(async () => root.render(React.createElement(SiteInstallPage)));
  expect(host.textContent).toContain('ainda não foi publicada');
  vi.mocked(api.post).mockResolvedValue({ version: 1 });
  await act(async () => publishButton().click());
  expect(api.post).not.toHaveBeenCalled();
  expect(host.querySelector('#publish-confirmation')?.textContent).toContain('Publicar a configuração deste site?');
  await confirmPublication();
  expect(window.confirm).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/sites/site/config/publish');
  expect(state.reload).toHaveBeenCalledOnce();
  expect(host.textContent).toContain('Configuração publicada (v1).');
  expect(host.textContent).not.toContain('ainda não foi publicada');
  state.siteId = 'other';
  await act(async () => root.render(React.createElement(SiteInstallPage)));
  expect(api.get).toHaveBeenLastCalledWith('/sites/other/snippet');
  expect(host.textContent).not.toContain('Configuração publicada (v1).');
});

it('does not publish when confirmation is canceled', async () => {
  await act(async () => root.render(React.createElement(SiteInstallPage)));
  await act(async () => publishButton().click());
  await act(async () => host.querySelector<HTMLButtonElement>('#publish-confirmation button')!.click());
  expect(host.querySelector('#publish-confirmation')).toBeNull();
  expect(window.confirm).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(state.reload).not.toHaveBeenCalled();
  expect(host.textContent).toContain('ainda não foi publicada');
});

it('keeps the notice and permits retry when publication fails', async () => {
  await act(async () => root.render(React.createElement(SiteInstallPage)));
  vi.mocked(api.post).mockRejectedValue(new Error('Sem conexão'));
  await act(async () => publishButton().click());
  await confirmPublication();
  expect(host.textContent).toContain('Não foi possível publicar: Sem conexão');
  expect(host.textContent).toContain('ainda não foi publicada');
  expect(publishButton().disabled).toBe(false);
  expect(state.reload).not.toHaveBeenCalled();
  expect(host.querySelector<HTMLButtonElement>('#publish-confirmation button:last-child')!.disabled).toBe(false);
  vi.mocked(api.post).mockResolvedValue({ version: 1 });
  await confirmPublication();
  expect(host.textContent).toContain('Configuração publicada (v1).');
});

it('hides publication for viewers and explains who can publish', async () => {
  state.role = 'viewer';
  await act(async () => root.render(React.createElement(SiteInstallPage)));
  expect(publishButton()).toBeNull();
  expect(host.textContent).toContain('Peça a um editor ou administrador');
});

it('tracks only edits made on this screen and clears the local notice after successful publication', async () => {
  state.version = 3;
  await act(async () => root.render(React.createElement(SiteInstallPage)));
  expect(host.textContent).not.toContain('Há alterações feitas nesta tela');
  await act(async () => host.querySelector<HTMLButtonElement>('#goals button')!.click());
  expect(host.textContent).toContain('Há alterações feitas nesta tela');
  expect(api.post).not.toHaveBeenCalled();
  vi.mocked(api.post).mockResolvedValue({ version: 4 });
  await act(async () => publishButton().click());
  await confirmPublication();
  expect(host.textContent).not.toContain('Há alterações feitas nesta tela');
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/sites/site/snippet');
});

it('blocks publication when the installation data fails to load', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('Sem conexão'));
  await act(async () => root.render(React.createElement(SiteInstallPage)));
  expect(host.textContent).toContain('Sem conexão');
  expect(publishButton().disabled).toBe(true);
});
