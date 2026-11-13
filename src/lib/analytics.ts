export interface EventCount { event: string; count: number }
export interface SectionRow { section: string; views: number; deadClicks: number; rageClicks: number; dwellMs: number }

export const eventLabels: Record<string, string> = {
  page_view: 'Visualizações', cta_click: 'Cliques em CTA', form_submit: 'Formulários enviados',
  conversion: 'Conversões', dead_click: 'Cliques sem resposta', rage_click: 'Cliques repetidos',
  scroll_depth: 'Rolagem', hover: 'Atenção do cursor', exposure: 'Exposições a experimentos',
};
export function greeting(hour: number): string {
  return hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
}
export function barWidth(value: number, max: number): number {
  return max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
}
