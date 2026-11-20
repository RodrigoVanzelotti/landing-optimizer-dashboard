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

export const experimentTypeLabels: Record<string, string> = {
  copy: 'Texto', cta: 'Chamada para ação', headline: 'Título', subheadline: 'Subtítulo',
  button_style: 'Estilo de botão', section_order: 'Ordem das seções',
  section_visibility: 'Visibilidade das seções', layout_class: 'Estilo da página',
};

export const changeOpLabels: Record<string, string> = {
  set_text: 'Alterar texto', set_html_safe: 'Alterar HTML seguro', set_attr: 'Alterar atributo',
  add_class: 'Adicionar classe', remove_class: 'Remover classe', hide: 'Ocultar', show: 'Exibir', reorder: 'Reordenar',
};
