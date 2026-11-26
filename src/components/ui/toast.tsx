'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ToastContainer, toast as notify } from 'react-toastify/unstyled';
import { Button } from './button';

export const toast = {
  success: (message: string) => notify.success(message, { role: 'status' }),
  error: (message: string) => notify.error(message, { role: 'alert' }),
  info: (message: string) => notify.info(message, { role: 'status' }),
};

export function ToastViewport() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = document.createElement('div');
    const clocks = new WeakMap<Element, { time: number; sampledAt: number; running: boolean }>();
    const sync = () => {
      const target = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1) ?? document.body;
      if (element.parentElement !== target) {
        // Reparenting restarts CSS animations; preserve the library's elapsed time.
        const saved = [...element.querySelectorAll('.Toastify__progress-bar')].map(bar => {
          const clock = clocks.get(bar);
          const time = bar.getAnimations?.()[0]?.currentTime ?? (clock ? clock.time + (clock.running ? performance.now() - clock.sampledAt : 0) : null);
          return { bar, time };
        });
        target.append(element);
        saved.forEach(({ bar, time }) => {
          const animation = bar.getAnimations?.()[0];
          if (animation && time != null) animation.currentTime = time;
        });
      }
      element.querySelectorAll('[role="progressbar"]').forEach(bar => bar.setAttribute('aria-label', 'Tempo restante da notificação'));
      element.querySelectorAll('.Toastify__progress-bar').forEach(bar => {
        const animation = bar.getAnimations?.()[0];
        if (typeof animation?.currentTime === 'number') clocks.set(bar, { time: animation.currentTime, sampledAt: performance.now(), running: getComputedStyle(bar).animationPlayState === 'running' });
      });
    };
    sync(); setHost(element);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'style'] });
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', sync);
    return () => {
      observer.disconnect(); document.removeEventListener('focusin', sync); document.removeEventListener('focusout', sync);
      notify.dismiss(); notify.clearWaitingQueue(); element.remove();
    };
  }, []);

  return host && createPortal(<ToastContainer position="bottom-right" autoClose={8000} pauseOnHover pauseOnFocusLoss
    hideProgressBar={false} closeOnClick={false} draggable={false} transition={undefined}
    aria-label="Notificações" className="dashboard-toasts"
    closeButton={({ closeToast }) => <Button type="button" variant="ghost" className="ml-auto h-11 w-11 shrink-0 p-0" aria-label="Dispensar notificação" onClick={closeToast}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5"><path d="m6 6 12 12M6 18 18 6" /></svg>
    </Button>} />, host);
}
