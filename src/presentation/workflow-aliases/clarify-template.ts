// Derived from the OMX clarify example, but kept read-only so previewing the
// alias never implies file writes or command execution.
const CLARIFY_PROMPT = [
  'Clarify the task without editing files or running commands.',
  'Identify scope, non-goals, acceptance criteria, risks, and open questions.',
  'Present a concise plan draft in your response, then wait for approval before implementation.',
].join(' ');

const CLARIFY_WORKFLOW_TEMPLATE = [
  'Goal: clarify the request, record boundaries, and produce an inspectable plan draft',
  '',
  'flow:',
  `  prompt: ${CLARIFY_PROMPT}`,
  '  approve "Review the clarify summary and approve before implementation."',
  '',
].join('\n');

export const CLARIFY_WORKFLOW_ALIAS = {
  alias: 'clarify',
  summary: 'Clarify scope before implementation',
  description: 'Inspectable, side-effect-free prompt flow for scoping and plan drafting.',
  flowText: CLARIFY_WORKFLOW_TEMPLATE,
  previewSafe: true,
} as const;
