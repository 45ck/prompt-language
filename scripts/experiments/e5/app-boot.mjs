#!/usr/bin/env node
/**
 * app-boot.mjs — Boot a CRM workspace app and wait for a health endpoint.
 *
 * Discovers the start command from package.json, spawns the process, polls
 * a health endpoint until it responds or times out. Returns a handle for
 * shutdown.
 *
 * Node-stdlib only. No new dependencies.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { request } from 'node:http';

const DEFAULT_PORT = 3000;
const HEALTH_PATHS = ['/', '/health', '/api/health', '/healthz'];
const POLL_INTERVAL_MS = 500;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Discover the start command from a workspace's package.json.
 * Tries: scripts.start, scripts.dev, scripts.serve, then common fallbacks.
 * @param {string} workspace - Path to workspace root
 * @returns {{ command: string, args: string[], port: number }}
 */
export async function discoverStartCommand(workspace) {
  const pkgPath = join(workspace, 'package.json');
  let pkg = {};
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    } catch {
      // malformed package.json — fall through to defaults
    }
  }

  const scripts = pkg.scripts ?? {};
  const port = detectPort(scripts) ?? DEFAULT_PORT;

  // Priority: start > dev > serve
  for (const key of ['start', 'dev', 'serve']) {
    if (scripts[key]) {
      return { command: 'npm', args: ['run', key], port };
    }
  }

  // Fallback: look for common entry files
  for (const entry of ['server.js', 'app.js', 'index.js', 'src/index.js', 'src/server.js']) {
    if (existsSync(join(workspace, entry))) {
      return { command: 'node', args: [entry], port };
    }
  }

  return null;
}

/**
 * Detect the port from script definitions or environment hints.
 * @param {Record<string, string>} scripts
 * @returns {number | null}
 */
function detectPort(scripts) {
  const all = Object.values(scripts).join(' ');
  const match = /(?:PORT|port)[=: ]+(\d{4,5})/.exec(all);
  if (match) return Number(match[1]);
  return null;
}

/**
 * Poll a health endpoint until it responds with 2xx or times out.
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<{ healthy: boolean, path: string | null, elapsed: number }>}
 */
async function waitForHealth(port, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const start = Date.now();
  const deadline = start + timeoutMs;

  while (Date.now() < deadline) {
    for (const path of HEALTH_PATHS) {
      try {
        const status = await httpGet(port, path, 2000);
        if (status >= 200 && status < 400) {
          return { healthy: true, path, elapsed: Date.now() - start };
        }
      } catch {
        // connection refused or timeout — keep polling
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return { healthy: false, path: null, elapsed: Date.now() - start };
}

/**
 * Make a simple HTTP GET and return the status code.
 * @param {number} port
 * @param {string} path
 * @param {number} timeoutMs
 * @returns {Promise<number>}
 */
function httpGet(port, path, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname: '127.0.0.1', port, path, method: 'GET', timeout: timeoutMs },
      (res) => {
        res.resume(); // drain
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Boot the CRM app in a workspace and wait for it to become healthy.
 *
 * @param {{ workspace: string, timeoutMs?: number }} opts
 * @returns {Promise<{
 *   ok: boolean,
 *   port: number,
 *   healthPath: string | null,
 *   elapsed: number,
 *   child: import('child_process').ChildProcess | null,
 *   shutdown: () => Promise<void>,
 *   error?: string
 * }>}
 */
export async function bootApp({ workspace, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const startCmd = await discoverStartCommand(workspace);
  if (!startCmd) {
    return {
      ok: false,
      port: 0,
      healthPath: null,
      elapsed: 0,
      child: null,
      shutdown: async () => {},
      error: 'No start command discovered in workspace',
    };
  }

  const { command, args, port } = startCmd;
  const env = { ...process.env, PORT: String(port), NODE_ENV: 'test' };

  const child = spawn(command, args, {
    cwd: workspace,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: true,
  });

  let stderr = '';
  child.stderr?.on('data', (c) => (stderr += c.toString()));

  // If the child exits immediately, capture the failure
  let exitedEarly = false;
  child.once('exit', () => {
    exitedEarly = true;
  });

  // Wait a moment for early exits
  await sleep(500);
  if (exitedEarly) {
    return {
      ok: false,
      port,
      healthPath: null,
      elapsed: 500,
      child: null,
      shutdown: async () => {},
      error: `Process exited immediately. stderr: ${stderr.slice(0, 500)}`,
    };
  }

  const health = await waitForHealth(port, timeoutMs);

  const shutdown = async () => {
    if (!child.killed) {
      child.kill('SIGTERM');
      await new Promise((r) => {
        child.once('exit', r);
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
          r();
        }, 5000);
      });
    }
  };

  if (!health.healthy) {
    await shutdown();
    return {
      ok: false,
      port,
      healthPath: null,
      elapsed: health.elapsed,
      child: null,
      shutdown: async () => {},
      error: `Health check timed out after ${health.elapsed}ms. stderr: ${stderr.slice(0, 500)}`,
    };
  }

  return {
    ok: true,
    port,
    healthPath: health.path,
    elapsed: health.elapsed,
    child,
    shutdown,
  };
}
