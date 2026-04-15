import { describe, it, expect } from 'vitest';
import {
  parseSkillEntry,
  buildSkillDirectiveBlock,
  type SkillDirective,
} from './skill-directive.js';

describe('parseSkillEntry', () => {
  it('treats plain string as required directive', () => {
    expect(parseSkillEntry('/code-review')).toEqual({
      name: '/code-review',
      required: true,
    });
  });

  it('trims whitespace from plain string', () => {
    expect(parseSkillEntry('  /lint  ')).toEqual({
      name: '/lint',
      required: true,
    });
  });

  it('parses required: prefix', () => {
    expect(parseSkillEntry('required:/deploy-check')).toEqual({
      name: '/deploy-check',
      required: true,
    });
  });

  it('parses optional: prefix', () => {
    expect(parseSkillEntry('optional:/security-review')).toEqual({
      name: '/security-review',
      required: false,
    });
  });

  it('trims whitespace after prefix', () => {
    expect(parseSkillEntry('optional:  /lint  ')).toEqual({
      name: '/lint',
      required: false,
    });
  });
});

describe('buildSkillDirectiveBlock', () => {
  it('returns empty string for empty directives', () => {
    expect(buildSkillDirectiveBlock([])).toBe('');
  });

  it('renders required skills with MUST language', () => {
    const directives: SkillDirective[] = [{ name: '/code-review', required: true }];
    const block = buildSkillDirectiveBlock(directives);
    expect(block).toContain('[Skill invocation directives]');
    expect(block).toContain('You MUST invoke');
    expect(block).toContain('  - /code-review');
    expect(block).toContain('[End skill directives]');
  });

  it('renders optional skills with SHOULD language', () => {
    const directives: SkillDirective[] = [{ name: '/lint', required: false }];
    const block = buildSkillDirectiveBlock(directives);
    expect(block).toContain('You SHOULD invoke');
    expect(block).toContain('  - /lint');
  });

  it('renders both required and optional skills', () => {
    const directives: SkillDirective[] = [
      { name: '/code-review', required: true },
      { name: '/security-review', required: true },
      { name: '/lint', required: false },
    ];
    const block = buildSkillDirectiveBlock(directives);
    expect(block).toContain('You MUST invoke');
    expect(block).toContain('  - /code-review');
    expect(block).toContain('  - /security-review');
    expect(block).toContain('You SHOULD invoke');
    expect(block).toContain('  - /lint');
    expect(block).toContain('After invoking each skill');
  });

  it('includes output hints when provided', () => {
    const directives: SkillDirective[] = [
      { name: '/code-review', required: true, outputHint: 'Store findings in review_result' },
    ];
    const block = buildSkillDirectiveBlock(directives);
    expect(block).toContain('  - /code-review — Store findings in review_result');
  });

  it('omits hint suffix when outputHint is undefined', () => {
    const directives: SkillDirective[] = [{ name: '/code-review', required: true }];
    const block = buildSkillDirectiveBlock(directives);
    expect(block).toContain('  - /code-review');
    expect(block).not.toContain(' — ');
  });
});
