/**
 * mcp-server — MCP server exposing prompt-language flow state.
 *
 * Resources:
 *   flow://state     — raw session state JSON
 *   flow://variables — variables map
 *   flow://gates     — completion gates and their status
 *   flow://audit     — rendered flow with status annotations
 *
 * Tools:
 *   flow_status       — structured summary of current flow
 *   flow_reset        — deletes session-state.json
 *   flow_set_variable — sets a variable in session state
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { renderFlow, renderTimingReport } from '../domain/render-flow.js';
import type { SessionState } from '../domain/session-state.js';
import type { VariableStore } from '../domain/variable-value.js';
import {
  resolveStateDir,
  readSessionState,
  writeSessionState,
  deleteSessionState,
} from './mcp-state-reader.js';

// ---- helpers ----------------------------------------------------------------

export function parseStateDirArg(): string | undefined {
  const idx = process.argv.indexOf('--state-dir');
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function buildStateDir(): string {
  return resolveStateDir(
    process.env['PROMPT_LANGUAGE_STATE_DIR'],
    parseStateDirArg(),
    process.cwd(),
  );
}

export function stateOrEmpty(state: SessionState | null): string {
  return state ? JSON.stringify(state, null, 2) : 'No active session';
}

// ---- resource handlers -------------------------------------------------------

function buildStateResource(server: McpServer, stateDir: string): void {
  server.registerResource(
    'flow-state',
    'flow://state',
    { description: 'Current prompt-language session state (raw JSON)' },
    async (_uri: URL) => {
      const state = await readSessionState(stateDir);
      return { contents: [{ uri: 'flow://state', text: stateOrEmpty(state) }] };
    },
  );
}

function buildVariablesResource(server: McpServer, stateDir: string): void {
  server.registerResource(
    'flow-variables',
    'flow://variables',
    { description: 'Variables map from current session state' },
    async (_uri: URL) => {
      const state = await readSessionState(stateDir);
      const text = state ? JSON.stringify(state.variables, null, 2) : 'No active session';
      return { contents: [{ uri: 'flow://variables', text }] };
    },
  );
}

function buildGatesResource(server: McpServer, stateDir: string): void {
  server.registerResource(
    'flow-gates',
    'flow://gates',
    { description: 'Completion gates and their current pass/fail status' },
    async (_uri: URL) => {
      const state = await readSessionState(stateDir);
      const text = state ? formatGates(state) : 'No active session';
      return { contents: [{ uri: 'flow://gates', text }] };
    },
  );
}

function buildAuditResource(server: McpServer, stateDir: string): void {
  server.registerResource(
    'flow-audit',
    'flow://audit',
    { description: 'Rendered flow with execution status annotations' },
    async (_uri: URL) => {
      const state = await readSessionState(stateDir);
      const text = state ? renderFlow(state) : 'No active session';
      return { contents: [{ uri: 'flow://audit', text }] };
    },
  );
}

// ---- tool handlers ----------------------------------------------------------

function buildStatusTool(server: McpServer, stateDir: string): void {
  server.registerTool(
    'flow_status',
    {
      description: 'Returns a structured summary of the current flow state',
      inputSchema: {},
    },
    async () => {
      const state = await readSessionState(stateDir);
      if (!state) {
        return { content: [{ type: 'text' as const, text: 'No active session' }] };
      }
      const summary = buildStatusSummary(state);
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    },
  );
}

function buildResetTool(server: McpServer, stateDir: string): void {
  server.registerTool(
    'flow_reset',
    {
      description: 'Deletes session-state.json, resetting the current session',
      inputSchema: {},
    },
    async () => {
      await deleteSessionState(stateDir);
      return { content: [{ type: 'text' as const, text: 'Session reset. State file deleted.' }] };
    },
  );
}

const SetVariableInput = {
  name: z.string().min(1).describe('Variable name'),
  value: z.string().describe('Variable value to set'),
};

function buildSetVariableTool(server: McpServer, stateDir: string): void {
  server.registerTool(
    'flow_set_variable',
    {
      description: 'Sets a variable in the current session state',
      inputSchema: SetVariableInput,
    },
    async ({ name, value }: { name: string; value: string }) => {
      const state = await readSessionState(stateDir);
      if (!state) {
        return { content: [{ type: 'text' as const, text: 'No active session' }], isError: true };
      }
      const updated: SessionState = {
        ...state,
        variables: { ...state.variables, [name]: value },
      };
      await writeSessionState(stateDir, updated);
      return {
        content: [{ type: 'text' as const, text: `Variable "${name}" set to "${value}"` }],
      };
    },
  );
}

// ---- formatting helpers -----------------------------------------------------

export interface GateDiagnosticSummary {
  command: string;
  exitCode: number;
  stderr: string;
}

interface GateSummary {
  predicate: string;
  status: 'pass' | 'fail' | 'pending';
  diagnostic?: GateDiagnosticSummary;
}

export function buildGateDiagnostic(
  command: string | undefined,
  exitCode: number | undefined,
  stderr: string | undefined,
): GateDiagnosticSummary {
  return {
    command: command ?? '',
    exitCode: exitCode ?? -1,
    stderr: stderr ?? '',
  };
}

export function formatGates(state: SessionState): string {
  const gates = state.flowSpec.completionGates;
  if (gates.length === 0) return 'No completion gates defined';

  const summaries: GateSummary[] = gates.map((g) => {
    const result = state.gateResults[g.predicate];
    const diag = state.gateDiagnostics[g.predicate];
    if (result === true) return { predicate: g.predicate, status: 'pass' };
    if (result === false) {
      const summary: GateSummary = { predicate: g.predicate, status: 'fail' };
      if (diag) {
        summary.diagnostic = buildGateDiagnostic(diag.command, diag.exitCode, diag.stderr);
      }
      return summary;
    }
    return { predicate: g.predicate, status: 'pending' };
  });

  return JSON.stringify(summaries, null, 2);
}

export interface FlowStatusSummary {
  goal: string;
  status: string;
  currentNodePath: readonly number[];
  completed: boolean;
  variables: VariableStore;
  iterationCount: number;
  gateCount: number;
  gatesPassing: number;
  timingReport?: string | undefined;
}

export function buildStatusSummary(state: SessionState): FlowStatusSummary {
  const gates = state.flowSpec.completionGates;
  const gatesPassing = gates.filter((g) => state.gateResults[g.predicate] === true).length;
  const iterationCount = Object.values(state.nodeProgress).reduce((sum, p) => sum + p.iteration, 0);

  return {
    goal: state.flowSpec.goal,
    status: state.status,
    currentNodePath: state.currentNodePath,
    completed: state.status === 'completed',
    variables: state.variables,
    iterationCount,
    gateCount: gates.length,
    gatesPassing,
    ...(state.status !== 'active' ? { timingReport: renderTimingReport(state) } : {}),
  };
}

// ---- entry point ------------------------------------------------------------

export function startMcpServer(): void {
  const stateDir = buildStateDir();
  const server = new McpServer(
    { name: 'prompt-language', version: '1.0.0' },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  buildStateResource(server, stateDir);
  buildVariablesResource(server, stateDir);
  buildGatesResource(server, stateDir);
  buildAuditResource(server, stateDir);

  buildStatusTool(server, stateDir);
  buildResetTool(server, stateDir);
  buildSetVariableTool(server, stateDir);

  const transport = new StdioServerTransport();
  server.connect(transport).catch((err: unknown) => {
    process.stderr.write(`[prompt-language-mcp] Fatal: ${String(err)}\n`);
    process.exit(1);
  });
}
