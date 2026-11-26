import './dialog-mock';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { ToastViewport, toast } from '../src/components/ui/toast';

let host: HTMLDivElement, root: Root;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(React.createElement(ToastViewport)));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('announces success and error without stealing focus and dismisses only the chosen message', async () => {
  const trigger = document.createElement('button'); host.append(trigger); trigger.focus();
  await act(async () => { toast.success('Meta salva.'); toast.error('Não foi possível publicar. Tente novamente.'); });
  expect(document.querySelector('[role="status"]')?.textContent).toContain('Meta salva.');
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Tente novamente.');
  expect(document.activeElement).toBe(trigger);
  const dismiss = document.querySelectorAll<HTMLButtonElement>('button[aria-label="Dispensar notificação"]');
  expect(dismiss).toHaveLength(2);
  await act(async () => dismiss[0].click());
  expect(document.body.textContent).not.toContain('Meta salva.');
  expect(document.body.textContent).toContain('Tente novamente.');
});

it('keeps notices across page content changes during their display time', async () => {
  await act(async () => toast.info('Os experimentos ficarão prontos em até 24 horas.'));
  await act(async () => root.render(React.createElement(React.Fragment, null, React.createElement(ToastViewport), React.createElement('main', null, 'Outra página'))));
  expect(document.body.textContent).toContain('24 horas');
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Dispensar notificação"]')!.click());
  expect(document.querySelector('[role="status"]')).toBeNull();
});

it('moves feedback into the active dialog so its dismiss button is operable, then restores it on close', async () => {
  const modal = document.createElement('dialog'); document.body.append(modal);
  try {
    await act(async () => modal.showModal());
    await act(async () => toast.error('A exclusão falhou. Sua confirmação foi preservada.'));
    expect(modal.querySelector('[role="alert"]')?.textContent).toContain('confirmação foi preservada');
    await act(async () => modal.querySelector<HTMLButtonElement>('button')!.click());
    expect(modal.querySelector('[role="alert"]')).toBeNull();
    await act(async () => toast.success('Dados salvos.'));
    await act(async () => modal.close());
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Dados salvos.');
  } finally { await act(async () => modal.remove()); }
});

it('clears previous account notifications when the dashboard unmounts', async () => {
  await act(async () => toast.success('Preferência da conta anterior salva.'));
  await act(async () => root.render(null));
  await act(async () => root.render(React.createElement(ToastViewport)));
  expect(document.querySelector('[role="status"]')).toBeNull();
});

it('uses an eight-second countdown and removes the toast when its progress animation ends', async () => {
  await act(async () => toast.success('Configuração publicada.'));
  const progress = document.querySelector<HTMLElement>('[role="progressbar"]')!;
  expect(progress.getAttribute('aria-label')).toBe('Tempo restante da notificação');
  expect(progress.style.animationDuration).toBe('8000ms');
  await act(async () => progress.dispatchEvent(new Event('animationend', { bubbles: true })));
  expect(document.querySelector('[role="status"]')).toBeNull();
});

it('pauses and resumes the countdown on hover without removing the toast', async () => {
  await act(async () => toast.info('Informação para ler.'));
  const notice = document.querySelector<HTMLElement>('[role="status"]')!;
  const progress = notice.querySelector<HTMLElement>('[role="progressbar"]')!;
  await act(async () => notice.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  expect(progress.style.animationPlayState).toBe('paused');
  await act(async () => notice.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
  expect(progress.style.animationPlayState).toBe('running');
});
