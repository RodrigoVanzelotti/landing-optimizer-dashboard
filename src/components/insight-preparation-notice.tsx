export function InsightPreparationNotice({ approvedAt }: { approvedAt: string }) {
  const deadline = new Date(Date.parse(approvedAt) + 24 * 60 * 60 * 1000);
  const overdue = Date.now() > deadline.getTime();
  return <div role="status" className="mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="mt-0.5 h-6 w-6 shrink-0 text-amber-700"><path d="M9 3h6m-5 0v6L4 19a1.3 1.3 0 0 0 1.1 2h13.8a1.3 1.3 0 0 0 1.1-2L14 9V3M7 15h10" /><path d="M10 17h.01M14 19h.01" /></svg>
    <div className="min-w-0">
    <p className="font-medium">{overdue ? 'A preparação está demorando mais que o previsto.' : 'Seus experimentos estão sendo preparados.'}</p>
    <p className="mt-1">{overdue ? 'O prazo de 24 horas após a aprovação do insight foi ultrapassado. Atualize a situação para acompanhar a disponibilidade.' : 'Os experimentos ficarão prontos em até 24 horas após a aprovação do insight, já aprovados e prontos para iniciar.'}</p>
    <p className="mt-2 text-xs text-amber-800">Prazo: até {deadline.toLocaleString('pt-BR')} (horário local).</p>
    </div>
  </div>;
}
