import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const SITE_ID = '01a1eefa-8765-7e82-9bd1-f101b8d8c976';
export const DOMAIN = 'aurora-mock.example.com';
export const DATASET = 'aurora-features-v2';
const DAY = 86_400_000;
const NIL = '00000000-0000-0000-0000-000000000000';
const requireApi = createRequire(new URL('../../landing-optimizer-api/package.json', import.meta.url));

export function demoId(label) {
  const hex = createHash('sha256').update(`${DATASET}:${SITE_ID}:${label}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function fixtures({ tenantId, actorId, goalId, now = new Date() }) {
  const { evaluationPlan, evaluateEvidence } = requireApi('./dist/modules/experiments/experiment-evidence.js');
  const { buildTimeline, storedReport } = requireApi('./dist/modules/analytics/experiment-report.js');
  const end = new Date(now.toISOString().slice(0, 10));
  const ago = days => new Date(+end - days * DAY);
  const insights = [
    ['pending', 'Clareza na chamada principal', 'Uma chamada que explica o próximo passo pode aumentar os contatos.', 'low'],
    ['risk', 'Mensagem de preço antes do cadastro', 'Explicar o investimento antes do formulário pode reduzir cadastros sem intenção.', 'high'],
    ['preparing', 'Benefícios próximos do formulário', 'Relembrar os benefícios pode facilitar a decisão de enviar o contato.', 'medium'],
    ['overdue', 'Comparação entre os planos', 'Explicar para quem cada plano é indicado pode facilitar a escolha.', 'low'],
    ['ready', 'Próximo passo mais previsível', 'Uma mensagem específica pode aumentar a conclusão do objetivo.', 'low'],
    ['rejected', 'Mais campos no formulário', 'Solicitar informações adicionais poderia qualificar os contatos, mas também aumentar a fricção.', 'high'],
  ].map(([key, title, detail, riskLevel]) => {
    const accepted = ['preparing', 'overdue', 'ready'].includes(key);
    const approvedAt = accepted ? key === 'ready' ? ago(21) : key === 'overdue' ? ago(2) : new Date(+now - 2 * 3_600_000) : null;
    return {
      key, id: demoId(`insight:${key}`), tenantId, siteId: SITE_ID, model: 'curated-demo-v2', kind: 'cta', riskLevel,
      approvedAt, approvedByUserId: accepted ? actorId : null,
      experimentsReadyAt: key === 'ready' ? ago(19) : null,
      rejectedAt: key === 'rejected' ? new Date(+now - 3_600_000) : null,
      rejectedByUserId: key === 'rejected' ? actorId : null,
      expectedImpact: 'Cenário fictício para explorar a interface. Não é uma previsão ou análise de visitantes reais.',
      createdAt: key === 'ready' ? ago(22) : ago(3),
      payload: {
        title: `Demonstração · ${title}`, detail: `Hipótese fictícia: ${detail}`, synthetic: true, dataset: DATASET,
        analysisPeriod: { from: ago(33).toISOString(), to: ago(3).toISOString(), timezone: 'UTC', observedFrom: ago(33).toISOString(), partial: false, sessions: 1000, pageViews: 1200 },
        kpis: [{ key: 'ctaClicksPerView', label: 'Cliques em CTA / visualização (fictício)', value: .2, unit: 'ratio', numerator: 240, denominator: 1200, definition: 'Cenário fictício: 240 cliques divididos por 1.200 visualizações; não representa visitantes únicos.' }],
        designContext: { selector: '#hero-cta', pagePath: '/', capturedAt: ago(3).toISOString(), text: 'Saiba mais', role: 'cta', observation: 'Exemplo fictício de uma chamada pouco específica.' },
        experimentProposals: [{ name: 'Chamada mais específica (fictícia)', type: 'cta', selector: '#hero-cta', originalValue: 'Saiba mais', proposedValue: 'Agendar demonstração' }],
      },
    };
  });
  const cases = [
    ['review', 'Aguardando decisão', 'pending_review', '#contato', 'Solicitar uma conversa', 2],
    ['approved', 'Proposta pronta para iniciar', 'approved', '#hero-cta', 'Conhecer a demonstração', 1],
    ['running', 'Chamada dos planos em andamento', 'running', '#plan-card', 'Comparar os planos', 12],
    ['running-decline', 'Perguntas frequentes em andamento', 'running', '#faq', 'Entender os próximos passos', 8],
    ['paused', 'Teste de benefícios pausado', 'paused', '#beneficios', 'Conheça os benefícios', 10],
    ['result-win', 'Resultado com melhora', 'completed', '#hero-cta', 'Agendar demonstração', 12],
    ['result-decline', 'Resultado com queda', 'completed', '#plan-card', 'Ver detalhes do plano', 8],
    ['result-equivalent', 'Resultado sem diferença relevante', 'completed', '#faq', 'Tire suas dúvidas', 10],
    ['accepted', 'Mudança mantida para todos', 'accepted', '#hero', 'Mais clareza para decidir', 12],
    ['rejected', 'Proposta recusada', 'rejected', '#contato', 'Preencha todos os campos', 10],
    ['reverted', 'Mudança revertida após o resultado', 'rolled_back', '#planos', 'Escolha seu plano', 8],
    ['expired', 'Proposta que não foi iniciada a tempo', 'approved', '#depoimentos', 'Conheça as histórias', 10],
  ];
  const events = [];
  const experiments = cases.map(([key, title, status, selector, proposedValue, rate]) => {
    const id = demoId(`experiment:${key}`);
    const hasResult = ['completed', 'accepted', 'rolled_back'].includes(status);
    const started = hasResult || ['running', 'paused'].includes(status);
    const start = ago(hasResult ? 18 : 10);
    const plan = evaluationPlan(1200, 120, 1, [.5, .5], start);
    const variants = [
      { id: demoId(`${key}:control`), name: 'Site base', isControl: true, weight: .5 },
      { id: demoId(`${key}:proposal`), name: 'Mudança proposta', isControl: false, weight: .5 },
    ];
    let resultSnapshot;
    if (hasResult) {
      const rows = Array.from({ length: 14 }, (_, day) => variants.map((variant, arm) => ({ date: new Date(+start + day * DAY).toISOString(), variant_id: variant.id, exposures: 10000, conversions: arm ? rate * 100 : 1000 }))).flat();
      const cutoff = new Date(+start + 14 * DAY);
      const timeline = buildTimeline(variants, rows, start, cutoff);
      const evidence = evaluateEvidence(timeline.variants, plan, cutoff);
      resultSnapshot = { version: 1, synthetic: true, dataset: DATASET, experimentId: id, experiment: { id, siteId: SITE_ID, name: `Demonstração · ${title}`, status }, goal: { id: goalId, name: 'lead_demo' }, plan, ...timeline, variants: timeline.variants.map(variant => ({ ...variant, decision: evidence.variants.find(item => item.variantId === variant.variantId)?.decision ?? 'collecting' })), evidence: evidence.variants, conclusive: evidence.conclusive, coverageComplete: true, conversionWindowHours: 24, recordedAt: new Date(+cutoff + DAY).toISOString() };
      assert(storedReport(resultSnapshot), `Invalid result for ${key}`);
      assert.equal(evidence.variants[0].decision, rate > 10 ? 'improvement' : rate < 10 ? 'decline' : 'equivalent');
    }
    if (['running', 'paused'].includes(status)) {
      for (let day = 0; day < 9; day++) for (const [arm, variant] of variants.entries()) for (let visit = 0; visit < 50; visit++) {
        const session = demoId(`${key}:${day}:${arm}:${visit}`);
        const time = +start + day * DAY + 12 * 3_600_000 + visit * 60_000;
        const base = { tenant_id: tenantId, site_id: SITE_ID, session_id: session, page_path: '/', referrer_host: '', device_category: visit % 3 ? 'mobile' : 'desktop', browser_category: 'chromium', country: 'BR', is_bot: 0, experiment_id: NIL, variant_id: NIL, section_id: '', selector: '', goal: '', scroll_depth: 0, dwell_ms: 0, value: 0, props: JSON.stringify({ synthetic: true, dataset: DATASET }) };
        const event = (event_name, seconds, extra = {}) => events.push({ ...base, event_time: new Date(time + seconds * 1000).toISOString().replace('T', ' ').replace('Z', ''), event_name, ...extra });
        event('page_view', 0);
        event('exposure', 1, { experiment_id: id, variant_id: variant.id });
        event('section_view', 5, { section_id: selector.slice(1), selector });
        if (visit < (arm ? rate / 2 : 5)) {
          event('cta_click', 10, { section_id: selector.slice(1), selector });
          event('form_start', 20, { section_id: 'contato', selector: '#lead-form' });
          event('form_submit', 40, { section_id: 'contato', selector: '#lead-form' });
          event('conversion', 41, { goal: 'lead_demo', value: 1, experiment_id: id, variant_id: variant.id });
        }
      }
    }
    const createdAt = key === 'expired' ? ago(10) : started ? new Date(+start - DAY) : ago(1);
    return { key, id, tenantId, siteId: SITE_ID, name: `Demonstração · ${title}`, hypothesis: 'Cenário inteiramente fictício para explorar o pipeline e comparar a versão base com a mudança proposta. Nenhum visitante real.', type: 'copy', status, primaryGoalId: goalId, insightId: ['approved', 'result-win'].includes(key) ? demoId('insight:ready') : null, createdBy: actorId, createdAt, startedAt: started ? start : null, endedAt: hasResult ? new Date(resultSnapshot.recordedAt) : null, allocation: 1, riskScore: key === 'review' ? 45 : 15, targeting: {}, ...(started ? { evaluationPlan: plan } : {}), ...(hasResult ? { resultSnapshot } : {}), winnerVariantId: status === 'accepted' ? variants[1].id : null, variants: { create: variants.map((variant, arm) => ({ ...variant, changes: { create: arm ? [{ id: demoId(`${key}:change`), selector, op: 'set_text', originalValue: 'Texto de referência fictício', proposedValue }] : [] } })) }, approvals: { create: [{ id: demoId(`${key}:approval`), status: status === 'pending_review' ? 'pending' : status === 'rejected' ? 'rejected' : 'approved', riskScore: key === 'review' ? 45 : 15, reason: 'Demonstração fictícia; não é uma decisão sobre um site real.', ...(status !== 'pending_review' ? { approverUserId: actorId, decidedAt: createdAt } : {}) }] } };
  });
  return { insights, experiments, events };
}

export async function main() {
  const applying = process.argv.includes('--apply');
  assert(process.env.DATABASE_URL && process.env.MOCK_API_URL && process.env.MOCK_ACCESS_TOKEN, 'Provide authorized database and API access through environment variables.');
  const headers = { Authorization: `Bearer ${process.env.MOCK_ACCESS_TOKEN}` };
  const response = await fetch(`${process.env.MOCK_API_URL}/auth/me`, { headers, signal: AbortSignal.timeout(30000) });
  assert(response.ok, 'Cannot verify the operator');
  const user = await response.json();
  assert(typeof user.id === 'string' && typeof user.tenantId === 'string', 'Cannot identify the authorized operator and workspace');
  assert(['admin', 'editor'].includes(user.role), 'An editor or administrator is required');
  const { PrismaClient } = requireApi('@prisma/client');
  const db = new PrismaClient();
  try {
    const site = await db.site.findFirstOrThrow({ where: { id: SITE_ID, tenantId: user.tenantId, primaryDomain: DOMAIN }, select: { id: true, tenantId: true, name: true, settings: true } });
    assert(site.name.includes('dados fictícios') && site.settings.mockData?.version === 'aurora-mock-v1', 'Refusing to seed a non-demo site');
    const goal = await db.conversionGoal.findFirstOrThrow({ where: { siteId: SITE_ID, name: 'lead_demo' }, select: { id: true } });
    const columns = await db.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('experiment','ai_suggestion')`;
    const enums = await db.$queryRaw`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=pg_enum.enumtypid WHERE pg_type.typname='ExperimentStatus'`;
    const column = (table, name) => columns.some(row => row.table_name === table && row.column_name === name);
    const resultsReady = column('experiment', 'evaluation_plan') && column('experiment', 'result_snapshot') && enums.some(row => row.enumlabel === 'accepted');
    const rejectionReady = column('ai_suggestion', 'rejected_at') && column('ai_suggestion', 'rejected_by_user_id');
    const data = fixtures({ tenantId: user.tenantId, actorId: user.id, goalId: goal.id });
    const insights = data.insights.filter(item => rejectionReady || !item.rejectedAt);
    const experiments = data.experiments.filter(item => resultsReady || !item.resultSnapshot);
    const existingExperiments = await db.experiment.findMany({ where: { id: { in: data.experiments.map(item => item.id) } }, select: { id: true, tenantId: true, siteId: true } });
    const existingInsights = await db.aiSuggestion.findMany({ where: { id: { in: data.insights.map(item => item.id) } }, select: { id: true, tenantId: true, siteId: true } });
    assert([...existingExperiments, ...existingInsights].every(item => item.tenantId === site.tenantId && item.siteId === site.id), 'Dataset IDs collide with another site');
    const newInsights = insights.filter(item => !existingInsights.some(existing => existing.id === item.id));
    const newExperiments = experiments.filter(item => !existingExperiments.some(existing => existing.id === item.id));
    const plan = { siteId: SITE_ID, domain: DOMAIN, dataset: DATASET, applying, resultsReady, rejectionReady, insights: newInsights.map(item => item.key), experiments: newExperiments.map(item => item.key), deferred: [...data.insights.filter(item => !insights.includes(item)), ...data.experiments.filter(item => !experiments.includes(item))].map(item => item.key) };
    console.log(JSON.stringify(plan));
    if (!applying) return;
    if (!newInsights.length && !newExperiments.length) { console.log('Dataset already present; existing decisions and dates preserved.'); return; }
    const inserted = await db.$transaction(async tx => {
      const [locked] = await tx.$queryRaw`SELECT settings FROM site WHERE id=${SITE_ID} AND tenant_id=${site.tenantId} FOR UPDATE`;
      assert(locked.settings.mockData?.version === 'aurora-mock-v1', 'Demo marker changed');
      const current = await tx.experiment.count({ where: { id: { in: newExperiments.map(item => item.id) } } });
      const currentInsights = await tx.aiSuggestion.count({ where: { id: { in: newInsights.map(item => item.id) } } });
      assert(current === 0 && currentInsights === 0, 'Concurrent seed detected; rerun the plan');
      for (const { key, rejectedAt, rejectedByUserId, ...item } of newInsights) {
        await tx.aiSuggestion.create({ data: { ...item, ...(rejectionReady ? { rejectedAt, rejectedByUserId } : {}) }, select: { id: true } });
      }
      for (const { key, evaluationPlan, ...item } of newExperiments) {
        await tx.experiment.create({ data: { ...item, ...(resultsReady && evaluationPlan ? { evaluationPlan } : {}) }, select: { id: true } });
      }
      const newIds = new Set(newExperiments.map(item => item.id));
      const events = data.events.filter(event => newIds.has(event.experiment_id));
      // Session events carry no experiment ID until exposure: include the whole new experiment session.
      const sessions = new Set(events.map(event => event.session_id));
      const rows = data.events.filter(event => sessions.has(event.session_id));
      for (let index = 0; index < rows.length; index += 1000) await tx.$executeRaw`INSERT INTO events SELECT * FROM jsonb_populate_recordset(NULL::events, ${JSON.stringify(rows.slice(index, index + 1000))}::jsonb)`;
      await tx.auditLog.create({ data: { id: demoId(`audit:${resultsReady}:${rejectionReady}`), tenantId: site.tenantId, actorUserId: user.id, action: 'site.updated', targetType: 'site', targetId: SITE_ID, metadata: { synthetic: true, dataset: DATASET, note: 'Carga adicional de cenários fictícios de Insights e Experimentos.', insights: newInsights.map(item => item.id), experiments: newExperiments.map(item => item.id), events: rows.length, deferred: plan.deferred } } });
      await tx.site.update({ where: { id: SITE_ID }, data: { configVersion: { increment: 1 }, settings: { ...locked.settings, featureDemo: { dataset: DATASET, loadedAt: new Date().toISOString(), resultsReady, rejectionReady } } } });
      return { insertedInsights: newInsights.length, insertedExperiments: newExperiments.length, insertedEvents: rows.length };
    }, { timeout: 120000 });
    console.log(JSON.stringify(inserted));
  } finally { await db.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : `Demo seed failed (${error.code ?? error.name}); no credentials logged.`); process.exitCode = 1; });
