import type { AwaitNode, FlowNode, SpawnNode, SwarmRoleDefinition } from '../domain/flow-node.js';
import { extractAskQuestion, isAskCondition } from '../domain/judge-prompt.js';

function renderAwaitTarget(target: AwaitNode['target']): string {
  if (target === 'all') return 'all';
  if (Array.isArray(target)) return target.join(' ');
  return `"${target}"`;
}

function formatSecondsTimeout(timeoutSeconds?: number): string {
  return timeoutSeconds != null ? ` timeout ${timeoutSeconds}` : '';
}

function formatRunTimeout(timeoutMs?: number): string {
  if (timeoutMs == null) return '';
  return ` [timeout ${Math.max(1, Math.ceil(timeoutMs / 1000))}]`;
}

function renderSpawnHeader(node: SpawnNode, pad: string): string {
  let header = `${pad}spawn "${node.name}"`;
  if (node.cwd != null) header += ` in "${node.cwd}"`;
  if (node.model != null) header += ` model "${node.model}"`;
  if (node.condition != null) header += ` if ${node.condition}`;
  if (node.vars != null && node.vars.length > 0) header += ` with vars ${node.vars.join(', ')}`;
  return header;
}

function renderRoleHeader(role: SwarmRoleDefinition, pad: string): string {
  let header = `${pad}role ${role.name}`;
  if (role.model != null) header += ` model "${role.model}"`;
  if (role.cwd != null) header += ` in "${role.cwd}"`;
  if (role.vars != null && role.vars.length > 0) header += ` with vars ${role.vars.join(', ')}`;
  return header;
}

function formatProfileClause(profile?: string): string {
  return profile != null ? ` using profile "${profile}"` : '';
}

function renderConditionHeader(
  condition: string,
  options: {
    readonly profile?: string | undefined;
    readonly groundedBy?: string | undefined;
    readonly maxRetries?: number | undefined;
  } = {},
): string {
  if (!isAskCondition(condition)) {
    return condition;
  }

  let rendered = `ask "${extractAskQuestion(condition)}"`;
  if (options.profile != null) {
    rendered += formatProfileClause(options.profile);
  }
  if (options.groundedBy != null) {
    rendered += ` grounded-by "${options.groundedBy}"`;
  }
  if (options.maxRetries != null) {
    rendered += ` max-retries ${options.maxRetries}`;
  }
  return rendered;
}

export function renderNodesToDsl(nodes: readonly FlowNode[], indent: number): string[] {
  const lines: string[] = [];
  for (const child of nodes) {
    lines.push(...renderNodeToDsl(child, indent));
  }
  return lines;
}

/** Render spawn body nodes back to DSL text for the child process. */
export function renderSpawnBody(node: SpawnNode): string {
  return renderNodesToDsl(node.body, 1).join('\n');
}

export function renderNodeToDsl(node: FlowNode, indent: number): string[] {
  const pad = '  '.repeat(indent);
  switch (node.kind) {
    case 'prompt':
      return [`${pad}prompt${formatProfileClause(node.profile)}: ${node.text.replace(/\n/g, ' ')}`];
    case 'run':
      return [`${pad}run: ${node.command.replace(/\n/g, ' ')}${formatRunTimeout(node.timeoutMs)}`];
    case 'let': {
      const keyword = node.declarationKind;
      const op = node.append ? '+=' : '=';
      let src: string;
      switch (node.source.type) {
        case 'literal':
          src = `"${node.source.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
          break;
        case 'prompt':
          src = `prompt${formatProfileClause(node.source.profile)} "${node.source.text}"`;
          break;
        case 'prompt_json':
          src = `prompt${formatProfileClause(node.source.profile)} "${node.source.text}" as json {\n${node.source.schema}\n}`;
          break;
        case 'run':
          src = `run "${node.source.command}"`;
          break;
        case 'memory':
          src = `memory "${node.source.key}"`;
          break;
        case 'empty_list':
          src = '[]';
          break;
      }
      return [`${pad}${keyword} ${node.variableName} ${op} ${src}`];
    }
    case 'break':
      return [`${pad}break`];
    case 'continue':
      return [`${pad}continue`];
    case 'while':
      return [
        `${pad}while ${renderConditionHeader(node.condition, {
          profile: node.askProfile,
          groundedBy: node.groundedBy,
          maxRetries: node.askMaxRetries,
        })} max ${node.maxIterations}${formatSecondsTimeout(node.timeoutSeconds)}`,
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    case 'until':
      return [
        `${pad}until ${renderConditionHeader(node.condition, {
          profile: node.askProfile,
          groundedBy: node.groundedBy,
          maxRetries: node.askMaxRetries,
        })} max ${node.maxIterations}${formatSecondsTimeout(node.timeoutSeconds)}`,
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    case 'retry': {
      const backoffTag = node.backoffMs != null ? ` backoff ${node.backoffMs / 1000}s` : '';
      return [
        `${pad}retry max ${node.maxAttempts}${formatSecondsTimeout(node.timeoutSeconds)}${backoffTag}`,
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    }
    case 'if':
      return [
        `${pad}if ${renderConditionHeader(node.condition, {
          profile: node.askProfile,
          groundedBy: node.groundedBy,
          maxRetries: node.askMaxRetries,
        })}`,
        ...node.thenBranch.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        ...(node.elseBranch.length > 0
          ? [`${pad}else`, ...node.elseBranch.flatMap((c) => renderNodeToDsl(c, indent + 1))]
          : []),
        `${pad}end`,
      ];
    case 'try':
      return [
        `${pad}try`,
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        ...(node.catchBody.length > 0
          ? [
              `${pad}catch ${node.catchCondition}`,
              ...node.catchBody.flatMap((c) => renderNodeToDsl(c, indent + 1)),
            ]
          : []),
        ...(node.finallyBody.length > 0
          ? [`${pad}finally`, ...node.finallyBody.flatMap((c) => renderNodeToDsl(c, indent + 1))]
          : []),
        `${pad}end`,
      ];
    case 'foreach': {
      const listPart = node.listCommand ? `run "${node.listCommand}"` : node.listExpression;
      return [
        `${pad}foreach ${node.variableName} in ${listPart}`,
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    }
    case 'spawn': {
      return [
        renderSpawnHeader(node, pad),
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    }
    case 'await':
      return [
        `${pad}await ${renderAwaitTarget(node.target)}${formatSecondsTimeout(node.timeoutSeconds)}`,
      ];
    case 'approve': {
      const approveTimeout = node.timeoutSeconds ? ` timeout ${node.timeoutSeconds / 60}m` : '';
      return [`${pad}approve "${node.message}"${approveTimeout}`];
    }
    case 'review': {
      const criteriaLine = node.criteria ? [`${pad}  criteria: "${node.criteria}"`] : [];
      const groundedByLine = node.groundedBy ? [`${pad}  grounded-by: ${node.groundedBy}`] : [];
      const strictTag = node.strict ? ' strict' : '';
      const judgeTag = node.judgeName ? ` using judge "${node.judgeName}"` : '';
      return [
        `${pad}review${strictTag}${judgeTag} max ${node.maxRounds}`,
        ...criteriaLine,
        ...groundedByLine,
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    }
    case 'race':
      return [
        `${pad}race${formatSecondsTimeout(node.timeoutSeconds)}`,
        ...node.children.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    case 'foreach_spawn':
      return [
        `${pad}foreach-spawn ${node.variableName} in "${node.listExpression}"`,
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    case 'remember': {
      if (node.key !== undefined && node.value !== undefined) {
        return [`${pad}remember key="${node.key}" value="${node.value}"`];
      }
      return [`${pad}remember "${node.text ?? ''}"`];
    }
    case 'send':
      return [`${pad}send "${node.target}" "${node.message}"`];
    case 'receive': {
      const fromPart = node.from !== undefined ? ` from "${node.from}"` : '';
      return [
        `${pad}receive ${node.variableName}${fromPart}${formatSecondsTimeout(node.timeoutSeconds)}`,
      ];
    }
    case 'swarm': {
      const roleLines = node.roles.flatMap((role) => [
        renderRoleHeader(role, `${pad}  `),
        ...role.body.flatMap((child) => renderNodeToDsl(child, indent + 2)),
        `${pad}  end`,
      ]);
      return [
        `${pad}swarm ${node.name}`,
        ...roleLines,
        `${pad}  flow:`,
        ...node.flow.flatMap((child) => renderNodeToDsl(child, indent + 2)),
        `${pad}  end`,
        `${pad}end`,
      ];
    }
    case 'start':
      return [`${pad}start ${node.targets.join(', ')}`];
    case 'return':
      return [`${pad}return ${node.expression}`];
    case 'snapshot':
      return [`${pad}snapshot "${node.name}"`];
    case 'rollback':
      return [`${pad}rollback to "${node.name}"`];
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}
