#!/usr/bin/env node

/**
 * prompt-language Live Execution Monitor (TUI).
 *
 * Run in a split terminal pane alongside Claude Code to watch flow
 * execution in real time: node tree, gate results, variables, and progress.
 *
 * Usage:
 *   npx @45ck/prompt-language watch
 *   # or from project root:
 *   node bin/watch.mjs
 */

import { readFileSync, existsSync, watch as fsWatch } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDomain = join(__dirname, '..', 'dist', 'domain');

// Dynamic imports — dist/ only exists after build
const { renderFlow } = await import(join(distDomain, 'render-flow.js'));
const { colorizeFlow } = await import(join(distDomain, 'colorize-flow.js'));

const cwd = process.cwd();
const plDir = join(cwd, '.prompt-language');
const statePath = join(plDir, 'session-state.json');

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

function render() {
  clearScreen();

  const header = ' prompt-language Live Execution Monitor';
  const separator = ' ' + '='.repeat(38);

  console.log(header);
  console.log(separator);

  let state;
  try {
    const raw = readFileSync(statePath, 'utf8');
    state = JSON.parse(raw);
  } catch {
    console.log('\n Waiting for flow to start...');
    console.log(` Watching: ${plDir}`);
    console.log('\n Press Ctrl+C to exit.');
    return;
  }

  const rendered = renderFlow(state);
  const colored = process.env.NO_COLOR ? rendered : colorizeFlow(rendered);
  console.log('');
  console.log(colored);

  const now = new Date().toLocaleTimeString();
  console.log(`\n Last updated: ${now}`);
}

// Initial render
render();

// Debounced watcher
let debounceTimer = null;

function scheduleRender() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 100);
}

function startWatching() {
  try {
    fsWatch(plDir, { recursive: true }, scheduleRender);
  } catch {
    // fs.watch unavailable — fall back to polling
    setInterval(render, 1000);
  }
}

if (existsSync(plDir)) {
  startWatching();
} else {
  // Directory doesn't exist yet — poll until it appears
  const pollId = setInterval(() => {
    if (existsSync(plDir)) {
      clearInterval(pollId);
      render();
      startWatching();
    } else {
      render();
    }
  }, 1000);
}

// Clean exit on Ctrl+C
process.on('SIGINT', () => {
  clearScreen();
  console.log('prompt-language watch stopped.');
  process.exit(0);
});
