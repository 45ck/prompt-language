#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = join(ROOT, 'dist', 'infrastructure', 'mcp-server.js');

if (!existsSync(serverPath)) {
  console.error('Error: dist/ directory not found. Run "npm run build" first.');
  process.exit(1);
}

const { startMcpServer } = await import(pathToFileURL(serverPath).href);

await startMcpServer();
