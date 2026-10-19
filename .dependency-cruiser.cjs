/** Structural checks the import-level ESLint rules cannot express: cycles and orphans. */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make modules impossible to reason about and test in isolation.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment: 'A module nothing imports is dead code (tests and entry points excepted).',
      from: {
        orphan: true,
        pathNot: [
          '\\.test\\.ts$',
          '(^|/)src/index\\.ts$',
          '(^|/)src/cli\\.ts$',
          '\\.d\\.ts$',
          // SvelteKit finds its route files by name: nothing imports them.
          '(^|/)src/routes/\\+',
        ],
      },
      to: {},
    },
    {
      name: 'assist-stays-lazy',
      severity: 'error',
      comment:
        'ADR-0010: the query assist layer is fetched on demand (query-assist-loader.ts). A static import would put its lint, ' +
        'suggestions and list into the first script, which is what the initial JS budget keeps them out of.',
      from: { pathNot: '\\.test\\.ts$' },
      to: { path: '^apps/web/src/lib/query-assist\\.ts$', dependencyTypesNot: ['dynamic-import', 'type-only'] },
    },
    {
      name: 'core-stays-pure',
      severity: 'error',
      comment: 'ADR-0003: core depends on nothing outside itself.',
      from: { path: '^packages/core', pathNot: '\\.test\\.ts$' },
      to: { pathNot: ['^packages/core'], dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    exclude: { path: '(^|/)node_modules/|^apps/web/(build|\\.svelte-kit)/' },
  },
};
