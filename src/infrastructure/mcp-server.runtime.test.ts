import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFlowSpec } from '../domain/flow-spec.js';
import { createSessionState } from '../domain/session-state.js';

interface RegisteredResource {
  name: string;
  uri: string;
  handler: (uri: URL) => Promise<{ contents: { uri: string; text: string }[] }>;
}

interface RegisteredTool {
  name: string;
  handler: (input: { name: string; value: string }) => Promise<{
    content: { type: 'text'; text: string }[];
    isError?: boolean;
  }>;
}

const mockStateReader = {
  deleteSessionState: vi.fn(),
  readSessionState: vi.fn(),
  resolveStateDir: vi.fn(() => '/mock-state'),
  writeSessionState: vi.fn(),
};

let connectError: Error | null = null;
let registeredResources: RegisteredResource[] = [];
let registeredTools: RegisteredTool[] = [];
let connectCalls = 0;

vi.mock('./mcp-state-reader.js', () => mockStateReader);

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class MockStdioServerTransport {},
}));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class MockMcpServer {
    registerResource(
      name: string,
      uri: string,
      _meta: unknown,
      handler: (uri: URL) => Promise<{ contents: { uri: string; text: string }[] }>,
    ): void {
      registeredResources.push({ name, uri, handler });
    }

    registerTool(
      name: string,
      _meta: unknown,
      handler: (input: { name: string; value: string }) => Promise<{
        content: { type: 'text'; text: string }[];
        isError?: boolean;
      }>,
    ): void {
      registeredTools.push({ name, handler });
    }

    connect(_transport: unknown): Promise<void> {
      connectCalls += 1;
      if (connectError != null) {
        return Promise.reject(connectError);
      }
      return Promise.resolve();
    }
  },
}));

beforeEach(() => {
  connectCalls = 0;
  connectError = null;
  registeredResources = [];
  registeredTools = [];
  mockStateReader.deleteSessionState.mockReset();
  mockStateReader.readSessionState.mockReset();
  mockStateReader.resolveStateDir.mockReset();
  mockStateReader.resolveStateDir.mockReturnValue('/mock-state');
  mockStateReader.writeSessionState.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('mcp-server runtime wiring', () => {
  it('registers all resources/tools and connects transport', async () => {
    const mod = await import('./mcp-server.js');
    mod.startMcpServer();

    expect(connectCalls).toBe(1);
    expect(registeredResources.map((r) => r.name)).toEqual([
      'flow-state',
      'flow-variables',
      'flow-gates',
      'flow-audit',
    ]);
    expect(registeredTools.map((t) => t.name)).toEqual([
      'flow_status',
      'flow_reset',
      'flow_set_variable',
    ]);
  });

  it('serves no-session text when resources are requested without active state', async () => {
    mockStateReader.readSessionState.mockResolvedValue(null);
    const mod = await import('./mcp-server.js');
    mod.startMcpServer();

    const stateResource = registeredResources.find((r) => r.name === 'flow-state');
    const varsResource = registeredResources.find((r) => r.name === 'flow-variables');
    const gatesResource = registeredResources.find((r) => r.name === 'flow-gates');
    const auditResource = registeredResources.find((r) => r.name === 'flow-audit');
    expect(stateResource).toBeDefined();
    expect(varsResource).toBeDefined();
    expect(gatesResource).toBeDefined();
    expect(auditResource).toBeDefined();

    expect((await stateResource!.handler(new URL('flow://state'))).contents[0]?.text).toBe(
      'No active session',
    );
    expect((await varsResource!.handler(new URL('flow://variables'))).contents[0]?.text).toBe(
      'No active session',
    );
    expect((await gatesResource!.handler(new URL('flow://gates'))).contents[0]?.text).toBe(
      'No active session',
    );
    expect((await auditResource!.handler(new URL('flow://audit'))).contents[0]?.text).toBe(
      'No active session',
    );
  });

  it('sets a variable when state exists and rejects when state is missing', async () => {
    const spec = createFlowSpec('Runtime', []);
    const state = createSessionState('session-1', spec);
    mockStateReader.readSessionState.mockResolvedValueOnce(state).mockResolvedValueOnce(null);

    const mod = await import('./mcp-server.js');
    mod.startMcpServer();

    const setVariableTool = registeredTools.find((t) => t.name === 'flow_set_variable');
    expect(setVariableTool).toBeDefined();

    const okResult = await setVariableTool!.handler({ name: 'mode', value: 'strict' });
    expect(mockStateReader.writeSessionState).toHaveBeenCalledTimes(1);
    expect(mockStateReader.writeSessionState.mock.calls[0]?.[1]?.variables?.mode).toBe('strict');
    expect(okResult?.isError).toBeUndefined();

    const missingStateResult = await setVariableTool!.handler({ name: 'mode', value: 'strict' });
    expect(missingStateResult?.isError).toBe(true);
    expect(missingStateResult?.content[0]?.text).toContain('No active session');
  });

  it('logs fatal error and exits when connect rejects', async () => {
    connectError = new Error('connect failed');
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    const mod = await import('./mcp-server.js');
    mod.startMcpServer();

    await Promise.resolve();
    await Promise.resolve();

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('[prompt-language-mcp] Fatal: Error: connect failed'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
