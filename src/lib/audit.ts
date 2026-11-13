export const auditActionLabels: Record<string, string> = {
  'team.invited': 'Convite enviado', 'team.invitation_revoked': 'Convite revogado',
  'team.invitation_accepted': 'Convite aceito',
  'team.member_added': 'Pessoa adicionada à equipe', 'team.member_removed': 'Pessoa removida da equipe',
  'team.member_reactivated': 'Acesso à equipe reativado', 'team.role_changed': 'Perfil de acesso alterado',
  'site.created': 'Site cadastrado', 'site.updated': 'Site atualizado',
  'site.origin_added': 'Origem de site adicionada', 'site.origin_removed': 'Origem de site removida',
  'site.config_published': 'Configuração de site publicada',
  'goal.created': 'Meta criada', 'goal.updated': 'Meta atualizada', 'goal.deleted': 'Meta excluída',
  'guardrail.updated': 'Diretrizes da marca atualizadas',
  'experiment.created': 'Experimento criado', 'experiment.updated': 'Experimento atualizado',
  'experiment.submitted': 'Experimento enviado para revisão', 'experiment.approved': 'Experimento aprovado',
  'experiment.rejected': 'Experimento rejeitado', 'experiment.scheduled': 'Experimento agendado',
  'experiment.started': 'Experimento iniciado', 'experiment.paused': 'Experimento pausado',
  'experiment.completed': 'Experimento concluído', 'experiment.rolled_back': 'Experimento revertido',
  'experiment.killed': 'Experimento interrompido',
  'ai.analyzed': 'Análise de IA realizada', 'ai.materialized': 'Sugestão de IA convertida em experimento',
  'snapshot.created': 'Captura de página registrada', 'snapshot.deleted': 'Captura de página excluída',
  'snapshot.pruned': 'Capturas removidas pela retenção',
  'tenant.created': 'Workspace cadastrado', 'tenant.archived': 'Workspace arquivado', 'tenant.restored': 'Workspace reativado',
  'auth.login': 'Entrada na conta', 'auth.logout': 'Saída da conta',
  'auth.password_reset_requested': 'Redefinição de senha solicitada', 'auth.password_changed': 'Senha alterada',
};

export const auditTargetLabels: Record<string, string> = {
  user: 'Conta', user_membership: 'Acesso à equipe', team_invitation: 'Convite', site: 'Site',
  site_origin: 'Origem', conversion_goal: 'Meta', brand_guardrail: 'Diretrizes da marca',
  experiment: 'Experimento', page_snapshot: 'Captura', tenant: 'Workspace',
};
