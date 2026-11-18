import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const DAY = 86400000;
export const DOMAIN = 'aurora-mock.example.com';
export const VERSION = 'aurora-mock-v1';
const NIL = '00000000-0000-0000-0000-000000000000';
const requireApi = createRequire(new URL('../../landing-optimizer-api/package.json', import.meta.url));
const sections = ['hero', 'beneficios', 'depoimentos', 'planos', 'contato'];
export function id(label) {
  const hex = createHash('sha256').update(`${VERSION}:${label}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function random(seed) {
  let n = parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16);
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}
export function trafficDay({ day, start, end, tenantId, siteId }) {
  const rand = random(`${siteId}:${day.toISOString()}`);
  const age = Math.round((day - start) / DAY);
  const progress = Math.min(1, age / 735);
  const weekend = [0, 6].includes(day.getUTCDay()) ? 0.62 : 1;
  const campaign = age % 90 >= 72 ? 1.65 : 1;
  const count = Math.round((14 + 23 * progress) * weekend * campaign * (0.8 + rand() * 0.4));
  const rows = [];
  for (let visit = 0; visit < count; visit++) {
    const session = id(`${siteId}:${day.toISOString()}:${visit}`);
    const time = +day + Math.floor((11 + Math.pow(rand(), 0.65) * 12) * 3600000);
    const recent = Math.floor((end - day) / DAY);
    const experiment = recent <= 60 ? 'cta' : recent <= 120 ? 'headline' : null;
    const treatment = rand() > 0.5;
    const exp = experiment ? id(`${siteId}:experiment:${experiment}`) : NIL;
    const variant = experiment ? id(`${siteId}:${experiment}:${treatment ? 'treatment' : 'control'}`) : NIL;
    const base = {
      tenant_id: tenantId, site_id: siteId, session_id: session, page_path: '/',
      referrer_host: ['www.google.com', 'www.google.com', '', 'www.instagram.com', 'www.linkedin.com'][Math.floor(rand() * 5)],
      device_category: rand() < 0.62 ? 'mobile' : rand() < 0.9 ? 'desktop' : 'tablet',
      browser_category: rand() < 0.72 ? 'chromium' : rand() < 0.8 ? 'safari' : 'firefox',
      country: 'BR', is_bot: 0, experiment_id: NIL, variant_id: NIL,
      section_id: '', selector: '', goal: '', scroll_depth: 0, dwell_ms: 0, value: 0,
      props: JSON.stringify({ synthetic: true, dataset: VERSION }),
    };
    function event(name, seconds, extra = {}) {
      rows.push({ ...base, event_time: new Date(time + seconds * 1000).toISOString().replace('T', ' ').replace('Z', ''), event_name: name, ...extra });
    }
    event('page_view', 0);
    if (experiment) event('exposure', 1, { experiment_id: exp, variant_id: variant });
    const depth = rand();
    for (const [index, section] of sections.entries()) {
      if (index && depth < index * 0.19) break;
      const extra = { section_id: section, selector: `#${section}` };
      event('section_view', 2 + index * 12, extra);
      event('dwell', 9 + index * 12, { ...extra, dwell_ms: Math.round(2500 + rand() * 14000) });
      event('scroll_depth', 3 + index * 12, { scroll_depth: index * 25 });
    }
    if (base.device_category !== 'mobile') event('hover', 12, { selector: '#hero-cta', section_id: 'hero', dwell_ms: Math.round(500 + rand() * 2500) });
    if (rand() < 0.12) event('dead_click', 32, { selector: '#plan-card', section_id: 'planos' });
    if (rand() < (recent <= 18 ? 0.025 : 0.06)) event('rage_click', 35, { selector: '#faq', section_id: 'contato' });
    const clicks = rand() < (0.22 + progress * 0.12 + (treatment ? 0.06 : 0));
    if (clicks) {
      event('cta_click', 64, { selector: '#hero-cta', section_id: 'hero' });
      if (rand() < 0.74) {
        event('form_start', 72, { selector: '#lead-form', section_id: 'contato' });
        if (rand() < (0.32 + progress * 0.13 + (treatment ? 0.12 : 0))) {
          event('form_submit', 105, { selector: '#lead-form', section_id: 'contato' });
          event('conversion', 106, { goal: 'lead_demo', value: 1, experiment_id: exp, variant_id: variant });
          event('page_view', 107, { page_path: '/obrigado' });
        } else event('dropoff', 110, { selector: '#lead-form', section_id: 'contato' });
      }
    }
  }
  return rows.sort((a, b) => a.event_time.localeCompare(b.event_time));
}

async function snapshot() {
  const { default: sharp } = await import('sharp');
  const labels = ['Sua próxima ideia merece crescer.', 'Menos trabalho. Mais resultado.', 'Quem usa Aurora recomenda.', 'Um plano para cada fase.', 'Vamos conversar?'];
  const nodes = sections.map((section, i) => ({ selector: `#${section}`, role: 'section', rect: [60, 120 + i * 400, 1080, 360] }));
  nodes.push({ selector: '#hero-cta', role: 'cta', rect: [100, 350, 300, 60] }, { selector: '#plan-card', role: 'section', rect: [100, 1440, 300, 200] }, { selector: '#lead-form', role: 'form', rect: [100, 1830, 700, 170] }, { selector: '#faq', role: 'button', rect: [850, 1850, 240, 60] });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="2200"><rect width="1200" height="2200" fill="#f8fafc"/><text x="60" y="65" font-family="sans-serif" font-size="30" fill="#0f172a">AURORA · SITE DE DEMONSTRAÇÃO</text>${labels.map((label, i) => `<rect x="60" y="${120 + i * 400}" width="1080" height="360" rx="18" fill="${i % 2 ? '#e2e8f0' : '#ffffff'}"/><text x="100" y="${185 + i * 400}" font-family="sans-serif" font-size="32" fill="#0f172a">${label}</text><text x="100" y="${235 + i * 400}" font-family="sans-serif" font-size="19" fill="#475569">${['Transforme visitantes em oportunidades com uma experiência simples.', 'Automação, relatórios e acompanhamento em um só lugar.', 'Mais tempo para o que importa. Mais clareza para decidir.', 'Essencial R$ 99 · Profissional R$ 249 · Equipes R$ 499', 'Nome · E-mail profissional · Enviar solicitação'][i]}</text>`).join('')}<rect x="100" y="350" width="300" height="60" rx="12" fill="#2563eb"/><text x="130" y="388" font-family="sans-serif" font-size="20" fill="white">Agendar demonstração</text><rect x="100" y="1440" width="300" height="200" rx="12" fill="#cbd5e1"/><text x="130" y="1535" font-family="sans-serif" font-size="24">Plano Profissional</text><rect x="100" y="1830" width="700" height="170" rx="12" fill="#cbd5e1"/><text x="130" y="1930" font-family="sans-serif" font-size="24">Solicitar contato</text><text x="855" y="1890" font-family="sans-serif" font-size="20">Perguntas frequentes</text><text x="60" y="2170" font-family="sans-serif" font-size="18">Dados e conteúdo fictícios · Nenhum visitante real</text></svg>`;
  return { image: await sharp(Buffer.from(svg)).png().toBuffer(), nodes };
}

export async function main() {
  const api = process.env.MOCK_API_URL ?? 'http://localhost:3001/v1';
  const email = process.env.MOCK_EMAIL ?? 'rodrigovanzelotti@gmail.com';
  assert(process.env.MOCK_PASSWORD && process.env.DATABASE_URL, 'Set MOCK_PASSWORD and DATABASE_URL.');
  const backend = process.env.ANALYTICS_BACKEND ?? 'postgres';
  assert(['postgres', 'clickhouse'].includes(backend), 'Unknown ANALYTICS_BACKEND');
  let token;
  async function request(method, path, body) {
    const response = await fetch(api + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    assert(response.ok, `${method} ${path}: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  const auth = await request('POST', '/auth/login', { email, password: process.env.MOCK_PASSWORD });
  token = auth.accessToken;
  assert.equal(auth.user.email, email);
  const { PrismaClient } = requireApi('@prisma/client');
  const db = new PrismaClient();
  let ch;
  try {
    // Validate API/database identity before creating anything in either environment.
    const membership = await db.userMembership.findFirst({ where: { userId: auth.user.id, tenantId: auth.user.tenantId, user: { email }, tenant: { archivedAt: null } } });
    assert(membership && ['owner', 'admin', 'editor'].includes(membership.role), 'API and database/account must match');
    if (backend === 'postgres') await db.$queryRaw`SELECT event_time FROM events LIMIT 0`;
    else {
      const { createClient } = requireApi('@clickhouse/client');
      ch = createClient({ url: process.env.CLICKHOUSE_URL ?? 'http://localhost:8123', database: process.env.CLICKHOUSE_DB ?? 'landing_optimizer', username: process.env.CLICKHOUSE_USER ?? 'default', password: process.env.CLICKHOUSE_PASSWORD ?? '', clickhouse_settings: { async_insert: 0 } });
      assert((await ch.ping()).success, 'ClickHouse unavailable');
    }
    let site = (await request('GET', '/sites')).find(s => s.primaryDomain === DOMAIN);
    if (!site) site = await request('POST', '/sites', { name: 'Aurora · Demonstração (dados fictícios)', primaryDomain: DOMAIN });
    let stored = await db.site.findFirstOrThrow({ where: { id: site.id, tenantId: auth.user.tenantId } });
    let state = stored.settings.mockData;
    assert(!state || state.version === VERSION, 'Mock dataset version mismatch');
    if (!state) {
      const existing = backend === 'postgres' ? await db.$queryRaw`SELECT count(*)::int AS n FROM events WHERE site_id = ${site.id}` : (await ch.query({ query: 'SELECT count() AS n FROM events WHERE site_id = {site:String}', query_params: { site: site.id }, format: 'JSONEachRow' })).json();
      const counts = await existing;
      assert.equal(Number(counts[0].n), 0, 'Refusing to mix mock data with existing traffic');
      const end = new Date(new Date().toISOString().slice(0, 10));
      state = { version: VERSION, start: new Date(+end - 735 * DAY).toISOString(), end: end.toISOString(), completedDays: 0, events: 0 };
      const capture = await snapshot();
      await db.$transaction(async tx => {
        await tx.site.update({ where: { id: site.id }, data: { createdAt: new Date(state.start), settings: { ...stored.settings, mockData: state } } });
        const goalId = id(`${site.id}:goal`);
        await tx.conversionGoal.create({ data: { id: goalId, siteId: site.id, name: 'lead_demo', kind: 'form_submit', matcher: { selector: '#lead-form' }, createdAt: new Date(state.start) } });
        await tx.brandGuardrail.create({ data: { id: randomUUID(), siteId: site.id, rules: { tone: 'Claro, acolhedor e direto', bannedWords: ['garantido'], mustKeepClaims: ['Dados fictícios de demonstração'], maxLength: 160 } } });
        await tx.pageMap.create({ data: { id: randomUUID(), siteId: site.id, urlPath: '/', map: { path: '/', nodes: capture.nodes.map(n => ({ selector: n.selector, role: n.role, tag: n.role === 'form' ? 'form' : 'section', text: n.selector.slice(1) })) } } });
        await tx.pageSnapshot.create({ data: { id: randomUUID(), siteId: site.id, urlPath: '/', width: 1200, height: 2200, contentType: 'image/png', image: capture.image, nodes: capture.nodes } });
        for (const [key, status, age, ended] of [['headline', 'completed', 120, 60], ['cta', 'running', 60, null], ['form', 'pending_review', 8, null], ['layout', 'draft', 3, null]]) {
          const expId = id(`${site.id}:experiment:${key}`);
          const createdAt = new Date(+end - age * DAY);
          await tx.experiment.create({ data: { id: expId, tenantId: auth.user.tenantId, siteId: site.id, name: `[MOCK] ${ { headline: 'Título orientado ao benefício', cta: 'CTA: agendar demonstração', form: 'Formulário com menos campos', layout: 'Hierarquia dos planos' }[key] }`, hypothesis: 'Simulação para visualizar o fluxo de revisão e resultados. Nenhum tráfego real.', status, type: key === 'headline' ? 'headline' : 'cta', primaryGoalId: goalId, allocation: 1, riskScore: key === 'form' ? 35 : 12, createdAt, startedAt: ['completed', 'running'].includes(status) ? createdAt : null, endedAt: ended ? new Date(+end - ended * DAY) : null, winnerVariantId: ended ? id(`${site.id}:${key}:treatment`) : null,
            variants: { create: ['control', 'treatment'].map((variant, i) => ({ id: id(`${site.id}:${key}:${variant}`), name: i ? 'Variação B' : 'Controle', isControl: !i, weight: 0.5, changes: { create: i ? [{ id: randomUUID(), selector: '#hero-cta', op: 'set_text', originalValue: 'Saiba mais', proposedValue: 'Agendar demonstração' }] : [] } })) },
            approvals: { create: status === 'draft' ? [] : [{ id: randomUUID(), status: status === 'pending_review' ? 'pending' : 'approved', reason: 'Exemplo sintético para demonstração', riskScore: 12, createdAt, decidedAt: status === 'pending_review' ? null : createdAt }] },
          } });
        }
        for (const [kind, title, detail, selector, proposedValue] of [
          ['cta', 'CTA com intenção mais clara', 'Hipótese fictícia: explicitar a demonstração pode melhorar a taxa de clique.', '#hero-cta', 'Agendar demonstração'],
          ['friction', 'Abandono no formulário', 'Simulação: visitantes iniciam o contato, mas parte abandona antes do envio.', '#lead-form', 'Solicitar contato'],
          ['section', 'Atenção aos planos', 'Simulação: cliques sem ação no cartão de preço indicam expectativa de navegação.', '#plan-card', 'Conhecer o plano'],
        ]) await tx.aiSuggestion.create({ data: { id: randomUUID(), tenantId: auth.user.tenantId, siteId: site.id, kind, model: 'synthetic-demo', payload: { title: `[MOCK] ${title}`, detail, selector, proposedValue }, expectedImpact: 'Hipótese ilustrativa; não é uma previsão', riskLevel: 'low' } });
        await tx.auditLog.create({ data: { id: randomUUID(), tenantId: auth.user.tenantId, action: 'site.updated', targetType: 'site', targetId: site.id, metadata: { synthetic: true, dataset: VERSION, note: 'Criação de cenário de demonstração' } } });
      }, { timeout: 30000 });
    }
    const start = new Date(state.start), end = new Date(state.end);
    for (let index = state.completedDays; index < 735; index++) {
      const day = new Date(+start + index * DAY);
      const rows = trafficDay({ day, start, end, tenantId: auth.user.tenantId, siteId: site.id });
      const next = { ...state, completedDays: index + 1, events: state.events + rows.length };
      if (backend === 'postgres') await db.$transaction(async tx => {
        const [locked] = await tx.$queryRaw`SELECT settings FROM site WHERE id = ${site.id} FOR UPDATE`;
        assert.equal(locked.settings.mockData.completedDays, index, 'Concurrent seed detected; rerun after it finishes');
        await tx.$executeRaw`INSERT INTO events SELECT * FROM jsonb_populate_recordset(NULL::events, ${JSON.stringify(rows)}::jsonb)`;
        await tx.site.update({ where: { id: site.id }, data: { settings: { ...stored.settings, mockData: next } } });
      }, { timeout: 30000 });
      else {
        // shortcut: ClickHouse and PostgreSQL cannot share a transaction; stop on uncertain/partial writes for operator inspection.
        const result = await ch.query({ query: 'SELECT count() AS n FROM events WHERE site_id = {site:String} AND event_time >= {from:DateTime64} AND event_time < {to:DateTime64}', query_params: { site: site.id, from: day.toISOString().replace('T', ' ').replace('Z', ''), to: new Date(+day + DAY).toISOString().replace('T', ' ').replace('Z', '') }, format: 'JSONEachRow' });
        assert.equal(Number((await result.json())[0].n), 0, 'Existing day in ClickHouse: inspect before retrying');
        await ch.insert({ table: 'events', values: rows, format: 'JSONEachRow' });
        await db.site.update({ where: { id: site.id }, data: { settings: { ...stored.settings, mockData: next } } });
      }
      state = next;
      if (index % 60 === 0 || index === 734) console.log(`Loaded ${index + 1}/735 days (${state.events} events)`);
    }
    // Read through public contracts, so this verifies what the dashboard will consume.
    for (const timeframe of ['7d', '30d', '6m', '1y']) {
      const report = await request('GET', `/analytics/report?siteId=${site.id}&timeframe=${timeframe}`);
      if (backend === 'postgres') assert(report.coverage.currentComplete && report.coverage.previousComplete, `Incomplete ${timeframe} coverage`);
      assert(report.current.pageViews > 0);
      if (report.coverage.previousComplete) assert(report.previous.pageViews > 0);
      assert(report.current.formStarts >= report.current.formCompletions);
      console.log(JSON.stringify({ timeframe, coverage: report.coverage, current: report.current, previous: report.previous }));
    }
    const heatmap = await request('GET', `/analytics/heatmap?siteId=${site.id}`);
    assert(heatmap.elements.length && heatmap.scrollDepth.length);
    console.log(JSON.stringify({ siteId: site.id, domain: DOMAIN, dataset: state, heatmapElements: heatmap.elements.length }));
  } finally { await db.$disconnect(); await ch?.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
