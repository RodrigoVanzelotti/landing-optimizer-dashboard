import next from 'eslint-config-next/core-web-vitals';

const config = [...next, {
  ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  // shortcut: existing effect-based loading warns; refactor it when changing data loading.
  rules: { 'react-hooks/set-state-in-effect': 'warn' },
}];

export default config;
