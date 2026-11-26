import type { GoalKind } from './api';

export const goalKindLabels: Record<GoalKind, string> = {
  event: 'Evento personalizado', url: 'Página de confirmação', form_submit: 'Tentativa de envio',
  element_visible: 'Elemento de confirmação',
};
