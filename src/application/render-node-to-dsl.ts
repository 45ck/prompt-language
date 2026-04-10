import type { FlowNode, SpawnNode } from '../domain/flow-node.js';

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
      return [`${pad}prompt: ${node.text.replace(/\n/g, ' ')}`];
    case 'run':
      return [`${pad}run: ${node.command.replace(/\n/g, ' ')}`];
    case 'let': {
      const op = node.append ? '+=' : '=';
      let src: string;
      switch (node.source.type) {
        case 'literal':
          src = `"${node.source.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
          break;
        case 'prompt':
          src = `prompt "${node.source.text}"`;
          break;
        case 'prompt_json':
          src = `prompt "${node.source.text}" as json {\n${node.source.schema}\n}`;
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
      return [`${pad}let ${node.variableName} ${op} ${src}`];
    }
    case 'break':
      return [`${pad}break`];
    case 'continue':
      return [`${pad}continue`];
    case 'while':
      return [
        `${pad}while ${node.condition} max ${node.maxIterations}`,
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    case 'until':
      return [
        `${pad}until ${node.condition} max ${node.maxIterations}`,
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    case 'retry': {
      const backoffTag = node.backoffMs != null ? ` backoff ${node.backoffMs / 1000}s` : '';
      return [
        `${pad}retry max ${node.maxAttempts}${backoffTag}`,
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    }
    case 'if':
      return [
        `${pad}if ${node.condition}`,
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
      const spawnHeader = node.cwd
        ? `${pad}spawn "${node.name}" in "${node.cwd}"`
        : `${pad}spawn "${node.name}"`;
      return [
        spawnHeader,
        ...node.body.flatMap((c) => renderNodeToDsl(c, indent + 1)),
        `${pad}end`,
      ];
    }
    case 'await':
      return [`${pad}await ${node.target === 'all' ? 'all' : `"${node.target}"`}`];
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
        `${pad}race`,
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
      return [`${pad}receive ${node.variableName}${fromPart}`];
    }
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}
