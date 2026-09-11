/**
 * Plain-language definitions and expectations for every number the dashboard
 * shows. Rule: a first-time user must never wonder "what is this and is my
 * number good?" — each KPI states what it measures and what to expect.
 * Benchmarks are deliberately broad; they orient, they don't judge.
 */

export interface KpiInfo {
  what: string;
  expect: string;
}

export const KPI_INFO: Record<string, KpiInfo> = {
  pageViews: {
    what: 'Tracked page loads across your site (one per visit to a page).',
    expect:
      'Should roughly match your web analytics tool. Reading 0? The snippet is not installed yet or no one has visited.',
  },
  conversions: {
    what: 'Completed goals — a visitor did the thing you defined as success.',
    expect:
      'Stays 0 until you define a conversion goal or your page calls LandingOptimizer.conversion().',
  },
  conversionRate: {
    what: 'Conversions ÷ page views.',
    expect:
      'Landing pages typically convert 1–5% of visitors; above 5% is strong. Varies a lot by industry and traffic source.',
  },
  ctaClicks: {
    what: 'Clicks on detected calls-to-action (buttons and signup/demo/trial links).',
    expect: 'A healthy primary CTA is clicked by roughly 2–10% of visitors.',
  },
};

/** Funnel / event-name explanations for the Analytics page. */
export const EVENT_INFO: Record<string, string> = {
  page_view: 'A page load. The top of every funnel.',
  scroll_depth: 'Visitors reaching 25/50/75/100% of the page.',
  cta_click: 'Clicks on detected calls-to-action.',
  dead_click: 'Clicks on things that are not interactive — visitors expected something there.',
  rage_click: 'Three or more rapid clicks in the same spot — a frustration signal.',
  form_start: 'A visitor focused a form field (values are never read).',
  form_submit: 'A form was submitted (values are never read).',
  section_view: 'A page section (hero, pricing, FAQ…) became visible.',
  hover: 'Aggregated pointer attention per element — where visitors linger.',
  dwell: 'Time-on-page pings while the tab is visible.',
  dropoff: 'The visitor left the page (fires on page hide).',
  exposure: 'A visitor was entered into an experiment variant.',
  conversion: 'A goal completion.',
  company_context: 'Optional non-personal B2B metadata sent by your site.',
};

export const SIGNIFICANCE_INFO =
  'Significant means the difference is unlikely to be luck (p < 0.05, two-proportion z-test, minimum 30 exposures per variant). Until then, treat lift as noise.';
