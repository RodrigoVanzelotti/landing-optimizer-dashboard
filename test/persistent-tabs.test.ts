import * as React from 'react';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { WorkspaceSettings } from '../src/components/workspace-settings';
import { SessionContext } from '../src/lib/session';

const mounted = vi.hoisted(() => ({ team: vi.fn(), audit: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock('../src/components/team-settings', () => ({ TeamSettings: () => { useEffect(() => { mounted.team(); }, []); return React.createElement('input', { 'aria-label': 'Team draft' }); } }));
vi.mock('../src/components/audit-settings', () => ({ AuditSettings: () => { useEffect(() => { mounted.audit(); }, []); return React.createElement('input', { 'aria-label': 'Audit filter' }); } }));

it('visits tabs lazily and preserves both a form draft and filters on returning', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, '', '/settings?tab=team');
  const host = document.createElement('div'), root = createRoot(host);
  const view = () => React.createElement(SessionContext.Provider, { value: { id: 'user', tenantId: 'tenant', role: 'admin', email: 'user@example.com', name: 'User' } }, React.createElement(WorkspaceSettings));
  const render = async () => { await act(async () => root.render(view())); };
  async function tab(name: string) {
    await act(async () => [...host.querySelectorAll('a')].find(link => link.textContent === name)!.click());
    await render();
  }
  try {
    await render();
    expect(mounted.team).toHaveBeenCalledTimes(1); expect(mounted.audit).not.toHaveBeenCalled();
    const draft = host.querySelector<HTMLInputElement>('input')!; draft.value = 'Unsent invitation';
    await tab('Registro de atividades');
    expect(window.location.search).toBe('?tab=audit');
    const filter = host.querySelector<HTMLInputElement>('[aria-label="Audit filter"]')!; filter.value = 'Saved filter';
    await tab('Equipe');
    expect(draft.value).toBe('Unsent invitation'); expect(draft.closest('[hidden]')).toBeNull();
    await tab('Registro de atividades');
    expect(filter.value).toBe('Saved filter'); expect(filter.closest('[hidden]')).toBeNull();
    expect(mounted.team).toHaveBeenCalledTimes(1); expect(mounted.audit).toHaveBeenCalledTimes(1);
  } finally { await act(async () => root.unmount()); vi.clearAllMocks(); }
});

it('does not mount restricted panels for a viewer', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, '', '/audit?tab=team');
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(React.createElement(SessionContext.Provider, { value: { id: 'viewer', tenantId: 'tenant', role: 'viewer', email: 'user@example.com', name: 'User' } }, React.createElement(WorkspaceSettings))));
    expect(mounted.team).not.toHaveBeenCalled(); expect(mounted.audit).toHaveBeenCalledTimes(1);
    expect([...host.querySelectorAll('a')].map(link => link.textContent)).toEqual(['Registro de atividades']);
  } finally { await act(async () => root.unmount()); vi.clearAllMocks(); }
});
