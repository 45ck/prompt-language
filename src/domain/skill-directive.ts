/**
 * SkillDirective — structured skill invocation instruction for agent orchestration.
 *
 * Skills are host-runtime assets (e.g. Claude Code slash commands). PL cannot
 * invoke them directly. A SkillDirective produces structured instructions that
 * tell the spawned agent to USE specific skills and optionally capture output.
 */

export interface SkillDirective {
  /** Skill name, e.g. "/code-review" or "/security-review". */
  readonly name: string;
  /** When true, the agent MUST invoke this skill; when false, it SHOULD. */
  readonly required: boolean;
  /** Optional hint for how the agent should capture or report skill output. */
  readonly outputHint?: string | undefined;
}

/**
 * Parse a skill entry — either a plain string or a structured directive.
 *
 * Plain string: `"/code-review"` → required directive with no output hint.
 * Prefixed string: `"optional:/lint"` → non-required directive.
 * Prefixed string: `"required:/deploy-check"` → required directive.
 */
export function parseSkillEntry(entry: string): SkillDirective {
  const trimmed = entry.trim();

  if (trimmed.startsWith('optional:')) {
    return {
      name: trimmed.slice('optional:'.length).trim(),
      required: false,
    };
  }

  if (trimmed.startsWith('required:')) {
    return {
      name: trimmed.slice('required:'.length).trim(),
      required: true,
    };
  }

  // Default: required
  return { name: trimmed, required: true };
}

/**
 * Build a directive-style instruction block for skill invocation.
 *
 * This produces structured text that tells the agent exactly how to use
 * the listed skills, distinguishing required vs optional.
 */
export function buildSkillDirectiveBlock(directives: readonly SkillDirective[]): string {
  if (directives.length === 0) {
    return '';
  }

  const required = directives.filter((d) => d.required);
  const optional = directives.filter((d) => !d.required);

  const lines: string[] = ['[Skill invocation directives]'];

  if (required.length > 0) {
    lines.push('You MUST invoke the following skills during this task:');
    for (const d of required) {
      const hint = d.outputHint != null ? ` — ${d.outputHint}` : '';
      lines.push(`  - ${d.name}${hint}`);
    }
  }

  if (optional.length > 0) {
    lines.push('You SHOULD invoke the following skills if relevant:');
    for (const d of optional) {
      const hint = d.outputHint != null ? ` — ${d.outputHint}` : '';
      lines.push(`  - ${d.name}${hint}`);
    }
  }

  lines.push('After invoking each skill, report its output or result in your response.');
  lines.push('[End skill directives]');

  return lines.join('\n');
}
