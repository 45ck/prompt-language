import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(testDir, '..', '..', '..');
const prdPath = join(rootDir, 'docs', 'prd.md');
const acceptanceCriteriaPath = join(rootDir, 'docs', 'acceptance-criteria.md');
const domainModelPath = join(
  rootDir,
  'docs',
  'architecture',
  'domain-model.md',
);
const apiContractsPath = join(rootDir, 'docs', 'api-contracts.md');
const invariantsPath = join(rootDir, 'specs', 'invariants.md');

describe('documentation', () => {
  it('includes the CRM core PRD', () => {
    expect(existsSync(prdPath)).toBe(true);

    const content = readFileSync(prdPath, 'utf8');

    expect(content).toContain('# CRM Core PRD');
    expect(content).toContain('## In Scope');
    expect(content).toContain('## Opportunity Stage Model');
  });

  it('includes the CRM core acceptance criteria', () => {
    expect(existsSync(acceptanceCriteriaPath)).toBe(true);

    const content = readFileSync(acceptanceCriteriaPath, 'utf8');

    expect(content).toContain('# CRM Core Acceptance Criteria');
    expect(content).toContain('## Structured Outputs');
    expect(content).toContain('## Ready-for-Test Checklist');
  });

  it('includes the CRM core domain model', () => {
    expect(existsSync(domainModelPath)).toBe(true);

    const content = readFileSync(domainModelPath, 'utf8');

    expect(content).toContain('# CRM Core Domain Model');
    expect(content).toContain('## Entities');
    expect(content).toContain('## Application Service Shape');
  });

  it('includes the CRM core API contracts', () => {
    expect(existsSync(apiContractsPath)).toBe(true);

    const content = readFileSync(apiContractsPath, 'utf8');

    expect(content).toContain('# CRM Core API Contracts');
    expect(content).toContain('## Contact Contracts');
    expect(content).toContain('## Dashboard Contract');
  });

  it('includes the CRM core invariants spec', () => {
    expect(existsSync(invariantsPath)).toBe(true);

    const content = readFileSync(invariantsPath, 'utf8');

    expect(content).toContain('# CRM Core Invariants');
    expect(content).toContain('### INV-001: Domain Purity');
    expect(content).toContain('## Suggested Verification Matrix');
  });
});
