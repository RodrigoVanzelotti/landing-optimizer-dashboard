import type { Experiment } from './api';

export const experimentStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  ai_suggested: 'Sugestão de IA',
  pending_review: 'Em revisão',
  approved: 'Aprovado',
  scheduled: 'Agendado',
  running: 'Em execução',
  paused: 'Pausado',
  completed: 'Concluído',
  rejected: 'Rejeitado',
  rolled_back: 'Revertido',
  killed: 'Interrompido',
};

export interface ExperimentFilters {
  search: string;
  type: string;
  risk: string;
  origin: string;
  period: string;
  sort: string;
}

export const experimentStages = [
  { id: 'waiting', label: 'Aguardando aprovação', description: 'Propostas para revisar ou iniciar.' },
  { id: 'running', label: 'Em experimentação', description: 'Testes em execução ou pausados.' },
  { id: 'results', label: 'Resultados disponíveis', description: 'Testes encerrados para consultar.' },
  { id: 'expired', label: 'Vencidos', description: 'Sete dias sem iniciar o experimento.' },
  { id: 'rejected', label: 'Negados', description: 'Propostas recusadas pelo usuário.' },
] as const;

export function experimentExpiry(experiment: Pick<Experiment, 'status' | 'createdAt' | 'expiresAt' | 'startedAt'>): number | null {
  if (!['draft', 'ai_suggested', 'pending_review', 'approved', 'scheduled'].includes(experiment.status) && !(experiment.status === 'paused' && experiment.startedAt === null)) return null;
  return Date.parse(experiment.expiresAt ?? experiment.createdAt) + (experiment.expiresAt ? 0 : 7 * 86_400_000);
}

export function experimentStage(experiment: Experiment, now: number): typeof experimentStages[number]['id'] {
  if (experiment.status === 'rejected') return 'rejected';
  const expires = experimentExpiry(experiment);
  if (experiment.expired || (expires !== null && expires <= now)) return 'expired';
  if (['running', 'paused'].includes(experiment.status)) return 'running';
  if (['completed', 'rolled_back', 'killed'].includes(experiment.status)) return 'results';
  return 'waiting';
}

export function filterExperiments(items: Experiment[], filters: ExperimentFilters, now: number): Experiment[] {
  const search = filters.search.trim().toLocaleLowerCase('pt-BR');
  return items.filter(item => {
    const created = Date.parse(item.createdAt);
    return (!search || item.name.toLocaleLowerCase('pt-BR').includes(search))
      && (!filters.type || item.type === filters.type)
      && (!filters.risk || (filters.risk === 'low' ? item.riskScore <= 30 : filters.risk === 'medium' ? item.riskScore > 30 && item.riskScore <= 60 : item.riskScore > 60))
      && (!filters.origin || (filters.origin === 'insight' ? !!item.insightId : !item.insightId))
      && (!filters.period || (created <= now && created >= now - Number(filters.period) * 86_400_000));
  }).sort((a, b) => filters.sort === 'name' ? a.name.localeCompare(b.name, 'pt-BR')
    : filters.sort === 'risk' ? b.riskScore - a.riskScore
    : filters.sort === 'oldest' ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
    : Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export const experimentTypeLabels: Record<string, string> = {
  copy: 'Texto', cta: 'Chamada para ação', headline: 'Título', subheadline: 'Subtítulo',
  button_style: 'Estilo de botão', section_order: 'Ordem das seções',
  section_visibility: 'Visibilidade das seções', layout_class: 'Estilo da página',
};

export const changeOpLabels: Record<string, string> = {
  set_text: 'Alterar texto', set_html_safe: 'Alterar HTML seguro', set_attr: 'Alterar atributo',
  add_class: 'Adicionar classe', remove_class: 'Remover classe', hide: 'Ocultar', show: 'Exibir', reorder: 'Reordenar',
};
