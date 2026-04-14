#!/usr/bin/env node
/**
 * documented-endpoint-probe.mjs — Probe documented HTTP endpoints for E5 journeys.
 *
 * Given a booted app (port) and a journey definition from crm-journeys.json,
 * discovers endpoint contracts from the workspace's OpenAPI spec or README,
 * makes HTTP requests, and returns pass/fail/skip per endpoint.
 *
 * Node-stdlib only. No new dependencies.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { request } from 'node:http';

/**
 * Known CRM entity → REST path mappings. These are the conventional paths
 * that a CRM factory lane is expected to expose. The journey suite uses
 * these as defaults when no OpenAPI contract is found.
 */
const ENTITY_PATHS = {
  contacts: '/api/contacts',
  companies: '/api/companies',
  opportunities: '/api/opportunities',
  tasks: '/api/tasks',
  notes: '/api/notes',
  deals: '/api/deals',
  pipelines: '/api/pipelines',
};

/**
 * Journey-to-probe mapping. Each journey ID maps to a sequence of HTTP
 * operations that prove the journey works end-to-end.
 */
const JOURNEY_PROBES = {
  J2: [
    {
      method: 'POST',
      entity: 'contacts',
      body: { name: 'Test Contact', email: 'test@e5.local' },
      expectStatus: [200, 201],
    },
    { method: 'GET', entity: 'contacts', expectStatus: [200], expectArray: true },
  ],
  J3: [
    {
      method: 'POST',
      entity: 'companies',
      body: { name: 'Test Company' },
      expectStatus: [200, 201],
    },
    { method: 'GET', entity: 'companies', expectStatus: [200], expectArray: true },
  ],
  J4: [
    {
      method: 'POST',
      entity: 'opportunities',
      body: { name: 'Test Deal', stage: 'prospect', value: 1000 },
      expectStatus: [200, 201],
    },
    { method: 'GET', entity: 'opportunities', expectStatus: [200], expectArray: true },
  ],
  J5: [
    {
      method: 'POST',
      entity: 'tasks',
      body: { title: 'Test Task', dueDate: '2026-12-31' },
      expectStatus: [200, 201],
    },
    { method: 'GET', entity: 'tasks', expectStatus: [200], expectArray: true },
  ],
  J6: [
    {
      method: 'POST',
      entity: 'contacts',
      body: { name: 'Note Contact', email: 'note@e5.local' },
      expectStatus: [200, 201],
      captureId: true,
    },
    {
      method: 'POST',
      entity: 'notes',
      body: { content: 'Test note' },
      expectStatus: [200, 201],
      usesCapturedId: true,
    },
  ],
};

/**
 * Try to read OpenAPI paths from the workspace contract file.
 * Falls back to conventional entity paths if no contract found.
 *
 * @param {string} workspace
 * @returns {Promise<Record<string, string>>} entity → path mapping
 */
export async function discoverEndpoints(workspace) {
  const contractPaths = [
    'openapi.json',
    'openapi.yaml',
    'openapi.yml',
    'docs/openapi.json',
    'docs/openapi.yaml',
    'api.yaml',
  ];

  for (const cp of contractPaths) {
    const fullPath = join(workspace, cp);
    if (!existsSync(fullPath)) continue;

    try {
      const raw = await readFile(fullPath, 'utf8');
      // Only handle JSON OpenAPI for now (YAML would need a parser)
      if (cp.endsWith('.json')) {
        const spec = JSON.parse(raw);
        return extractOpenAPIPaths(spec);
      }
    } catch {
      // malformed contract — fall through
    }
  }

  // Fallback: scan README for endpoint hints
  const readme = await readReadme(workspace);
  if (readme) {
    const discovered = extractPathsFromReadme(readme);
    if (Object.keys(discovered).length > 0) return discovered;
  }

  return { ...ENTITY_PATHS };
}

/**
 * Extract entity paths from an OpenAPI 3.x spec object.
 * @param {object} spec
 * @returns {Record<string, string>}
 */
function extractOpenAPIPaths(spec) {
  const paths = spec.paths ?? {};
  const result = {};
  for (const path of Object.keys(paths)) {
    // Infer entity name from path: /api/contacts → contacts
    const match = /\/(?:api\/)?(\w+)\/?$/.exec(path);
    if (match) {
      result[match[1]] = path;
    }
  }
  // Merge defaults for entities not found in spec
  for (const [entity, defaultPath] of Object.entries(ENTITY_PATHS)) {
    if (!result[entity]) result[entity] = defaultPath;
  }
  return result;
}

async function readReadme(workspace) {
  for (const name of ['README.md', 'README', 'readme.md']) {
    const p = join(workspace, name);
    if (existsSync(p)) {
      try {
        return await readFile(p, 'utf8');
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Extract API paths mentioned in a README (e.g., GET /api/contacts).
 * @param {string} readme
 * @returns {Record<string, string>}
 */
function extractPathsFromReadme(readme) {
  const result = {};
  const re = /(?:GET|POST|PUT|DELETE|PATCH)\s+(\/[\w/.-]+)/g;
  let m;
  while ((m = re.exec(readme)) !== null) {
    const path = m[1];
    const entityMatch = /\/(?:api\/)?(\w+)\/?$/.exec(path);
    if (entityMatch) {
      result[entityMatch[1]] = path;
    }
  }
  return result;
}

/**
 * Make an HTTP request and return structured result.
 * @param {{ port: number, method: string, path: string, body?: object, timeoutMs?: number }} opts
 * @returns {Promise<{ status: number, body: string, parsed: any | null, error?: string }>}
 */
function httpRequest({ port, method, path, body, timeoutMs = 5000 }) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = request(
      { hostname: '127.0.0.1', port, path, method, headers, timeout: timeoutMs },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c.toString()));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            // not JSON
          }
          resolve({ status: res.statusCode, body: data, parsed });
        });
      },
    );
    req.on('error', (err) => resolve({ status: 0, body: '', parsed: null, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, body: '', parsed: null, error: 'timeout' });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Probe a single journey's endpoints against a running app.
 *
 * @param {{
 *   journeyId: string,
 *   port: number,
 *   endpoints: Record<string, string>,
 * }} opts
 * @returns {Promise<{
 *   id: string,
 *   status: 'passed' | 'failed' | 'skipped',
 *   reason: string,
 *   steps: Array<{ method: string, path: string, status: number, passed: boolean, detail: string }>
 * }>}
 */
export async function probeJourney({ journeyId, port, endpoints }) {
  const probes = JOURNEY_PROBES[journeyId];
  if (!probes) {
    return {
      id: journeyId,
      status: 'skipped',
      reason: `No probe defined for journey ${journeyId}`,
      steps: [],
    };
  }

  const steps = [];
  let capturedId = null;
  let allPassed = true;

  for (const probe of probes) {
    const path = endpoints[probe.entity] ?? ENTITY_PATHS[probe.entity];
    if (!path) {
      steps.push({
        method: probe.method,
        path: `(unknown: ${probe.entity})`,
        status: 0,
        passed: false,
        detail: `No endpoint path for entity "${probe.entity}"`,
      });
      allPassed = false;
      continue;
    }

    // If this step depends on a captured ID (e.g., POST note on contact)
    let finalPath = path;
    const body = { ...probe.body };
    if (probe.usesCapturedId && capturedId) {
      // Try to attach the parent ID
      body.contactId = capturedId;
    }

    const result = await httpRequest({ port, method: probe.method, path: finalPath, body });

    if (result.error) {
      steps.push({
        method: probe.method,
        path: finalPath,
        status: 0,
        passed: false,
        detail: `Connection error: ${result.error}`,
      });
      allPassed = false;
      continue;
    }

    const statusOk = probe.expectStatus.includes(result.status);
    let arrayOk = true;
    if (probe.expectArray && statusOk) {
      arrayOk =
        Array.isArray(result.parsed) || (result.parsed && Array.isArray(result.parsed.data));
    }

    const passed = statusOk && arrayOk;
    if (!passed) allPassed = false;

    // Capture ID from creation response
    if (probe.captureId && result.parsed) {
      capturedId = result.parsed.id ?? result.parsed._id ?? null;
    }

    steps.push({
      method: probe.method,
      path: finalPath,
      status: result.status,
      passed,
      detail: passed
        ? 'OK'
        : `Expected status ${probe.expectStatus.join('|')}, got ${result.status}${!arrayOk ? ' (response not array)' : ''}`,
    });
  }

  return {
    id: journeyId,
    status: allPassed ? 'passed' : 'failed',
    reason: allPassed
      ? `All ${steps.length} probe steps passed`
      : `${steps.filter((s) => !s.passed).length}/${steps.length} steps failed`,
    steps,
  };
}
