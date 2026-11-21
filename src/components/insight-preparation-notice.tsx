export function InsightPreparationNotice({ approvedAt }: { approvedAt: string }) {
  const deadline = new Date(Date.parse(approvedAt) + 24 * 60 * 60 * 1000);
  const overdue = Date.now() > deadline.getTime();
  return <div role="status" className="mt-4 rounded-md border border-border bg-muted/40 p-4 text-sm leading-relaxed">
    <p className="font-medium">{overdue ? 'A preparação está demorando mais que o previsto.' : 'Seus experimentos estão sendo preparados.'}</p>
    <p className="mt-1">{overdue ? 'O prazo de 24 horas após a aprovação do insight foi ultrapassado. Atualize a situação para acompanhar a disponibilidade.' : 'Os experimentos ficarão prontos em até 24 horas após a aprovação do insight, já aprovados e prontos para iniciar.'}</p>
    <p className="mt-2 text-xs text-muted-foreground">Prazo: até {deadline.toLocaleString('pt-BR')} (horário local).</p>
  </div>;
}
