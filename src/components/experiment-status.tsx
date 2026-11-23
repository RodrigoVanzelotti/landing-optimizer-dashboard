import type { Experiment } from '@/lib/api';
import { experimentExpiry, experimentStatusLabels } from '@/lib/experiments';
import { Badge } from './ui/card';

export function ExperimentStatus({ experiment, now = Date.now() }: { experiment: Pick<Experiment, 'status' | 'createdAt' | 'expiresAt' | 'expired' | 'startedAt' | 'resultState'>; now?: number }) {
  const expiry = experimentExpiry(experiment);
  const expired = experiment.expired || (expiry !== null && expiry <= now);
  const waiting = ['draft', 'ai_suggested', 'pending_review'].includes(experiment.status);
  const label = experiment.resultState === 'pending_validation' ? 'Resultado em verificação' : expired ? 'Vencido' : waiting ? 'Aguardando aprovação' : experiment.status === 'approved' ? 'Aprovado · Pronto para iniciar' : experiment.status === 'running' ? 'Em experimentação' : experimentStatusLabels[experiment.status] ?? experiment.status;
  const tone = experiment.resultState === 'pending_validation' || expired || waiting || experiment.status === 'paused' ? 'amber' : ['running', 'approved', 'completed', 'accepted'].includes(experiment.status) ? 'green' : ['rejected', 'rolled_back', 'killed'].includes(experiment.status) ? 'red' : 'default';
  return <Badge tone={tone} className="max-w-full items-center gap-1.5 text-right font-medium"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{label}</Badge>;
}
