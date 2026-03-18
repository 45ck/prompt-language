/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-application',
      severity: 'error',
      comment: 'Domain must not depend on application layer.',
      from: { path: '^src/domain/' },
      to: { path: '^src/application/' },
    },
    {
      name: 'domain-no-infrastructure',
      severity: 'error',
      comment: 'Domain must not depend on infrastructure layer.',
      from: { path: '^src/domain/' },
      to: { path: '^src/infrastructure/' },
    },
    {
      name: 'domain-no-presentation',
      severity: 'error',
      comment: 'Domain must not depend on presentation layer.',
      from: { path: '^src/domain/' },
      to: { path: '^src/presentation/' },
    },
    {
      name: 'application-no-infrastructure',
      severity: 'error',
      comment: 'Application must not depend on infrastructure layer.',
      from: { path: '^src/application/', pathNot: '\\.test\\.ts$' },
      to: { path: '^src/infrastructure/' },
    },
    {
      name: 'application-no-presentation',
      severity: 'error',
      comment: 'Application must not depend on presentation layer.',
      from: { path: '^src/application/' },
      to: { path: '^src/presentation/' },
    },
    {
      name: 'infrastructure-no-presentation',
      severity: 'error',
      comment: 'Infrastructure must not depend on presentation layer.',
      from: { path: '^src/infrastructure/' },
      to: { path: '^src/presentation/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependencies allowed.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)' },
    },
  },
};
