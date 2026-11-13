export interface EventCount { event: string; count: number }
export interface SectionRow { section: string; views: number; deadClicks: number; rageClicks: number; dwellMs: number }

export const eventLabels: Record<string, string> = {
  page_view: 'Visualizações', cta_click: 'Cliques em CTA', form_start: 'Inícios de formulário', form_submit: 'Formulários enviados', section_view: 'Visualizações de seção',
  conversion: 'Conversões', dead_click: 'Cliques sem resposta', rage_click: 'Cliques repetidos',
  scroll_depth: 'Rolagem', hover: 'Atenção do cursor', exposure: 'Exposições a experimentos',
};
export function greeting(hour: number): string {
  return hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
}
export function barWidth(value: number, max: number): number {
  return max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
}

export const timeframeLabels = { '7d': 'Última semana', '30d': 'Últimos 30 dias', '6m': 'Últimos 6 meses', '1y': 'Último ano' };

export function chartPath(values: (number | null)[], maximum: number, width = 720): string {
  let connected = false;
  return values.map((value, index) => {
    if (value === null) { connected = false; return ''; }
    const command = connected ? 'L' : 'M';
    connected = true;
    return `${command}${48 + index / Math.max(1, values.length - 1) * (width - 72)},${208 - value / maximum * 184}`;
  }).join(' ');
}

export function changeLabel(current: number | null, previous: number | null, rate = false): string {
  if (current === null || previous === null) return 'Sem base para comparar';
  if (rate) {
    const delta = (current - previous) * 100;
    return `${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`;
  }
  if (!previous) return current ? 'Sem base anterior' : 'Sem variação';
  const delta = (current / previous - 1) * 100;
  return `${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
