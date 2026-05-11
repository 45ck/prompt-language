// Test suite for todo CLI. Written by frontier (Claude) before any local call.
// Each test is tagged with its task ID. Adversarial cases included.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const TODO_PATH = join(HERE, '..', 'workspace', 'todo.mjs');
const todo = await import(`file://${TODO_PATH.replace(/\\/g, '/')}`);

// ---------- T1: add ----------
test('T1_add_to_empty_assigns_id_1', () => {
  const s = todo.add({ items: [] }, 'first');
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].id, 1);
  assert.equal(s.items[0].text, 'first');
  assert.equal(s.items[0].done, false);
});
test('T1_add_increments_id', () => {
  let s = { items: [] };
  s = todo.add(s, 'a');
  s = todo.add(s, 'b');
  s = todo.add(s, 'c');
  assert.deepEqual(s.items.map((i) => i.id), [1, 2, 3]);
});
test('T1_add_after_remove_does_not_reuse_id', () => {
  let s = { items: [] };
  s = todo.add(s, 'a');
  s = todo.add(s, 'b');
  s = todo.remove(s, 1);
  s = todo.add(s, 'c');
  assert.deepEqual(s.items.map((i) => i.id), [2, 3]);
});
test('T1_add_does_not_mutate_input', () => {
  const original = { items: [] };
  const s = todo.add(original, 'x');
  assert.equal(original.items.length, 0);
  assert.notEqual(original, s);
});

// ---------- T2: list ----------
test('T2_list_empty_state', () => {
  const out = todo.list({ items: [] });
  assert.equal(typeof out, 'string');
  assert.match(out, /no.*todo|empty/i);
});
test('T2_list_includes_id_text_and_status', () => {
  const s = { items: [{ id: 1, text: 'buy milk', done: false }, { id: 2, text: 'sleep', done: true }] };
  const out = todo.list(s);
  assert.match(out, /1/);
  assert.match(out, /buy milk/);
  assert.match(out, /2/);
  assert.match(out, /sleep/);
});
test('T2_list_marks_done_distinctly_from_pending', () => {
  const s = { items: [{ id: 1, text: 'a', done: false }, { id: 2, text: 'b', done: true }] };
  const out = todo.list(s);
  const lineA = out.split('\n').find((l) => l.includes('a')) || '';
  const lineB = out.split('\n').find((l) => l.includes('b')) || '';
  assert.notEqual(lineA, lineB);
});

// ---------- T3: complete ----------
test('T3_complete_sets_done_true', () => {
  const s = todo.complete({ items: [{ id: 1, text: 'x', done: false }] }, 1);
  assert.equal(s.items[0].done, true);
});
test('T3_complete_throws_on_missing_id', () => {
  assert.throws(() => todo.complete({ items: [] }, 99));
});
test('T3_complete_does_not_mutate_input', () => {
  const original = { items: [{ id: 1, text: 'x', done: false }] };
  const s = todo.complete(original, 1);
  assert.equal(original.items[0].done, false);
  assert.notEqual(original.items[0], s.items[0]);
});

// ---------- T4: remove ----------
test('T4_remove_drops_item', () => {
  const s = todo.remove({ items: [{ id: 1, text: 'x', done: false }, { id: 2, text: 'y', done: false }] }, 1);
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].id, 2);
});
test('T4_remove_throws_on_missing_id', () => {
  assert.throws(() => todo.remove({ items: [] }, 99));
});
test('T4_remove_handles_high_id', () => {
  const s = todo.remove({ items: [{ id: 9999, text: 'x', done: false }] }, 9999);
  assert.equal(s.items.length, 0);
});

// ---------- T5: save / load ----------
test('T5_save_creates_file_with_json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
  const path = join(dir, 'state.json');
  todo.save({ items: [{ id: 1, text: 'x', done: false }] }, path);
  assert.equal(existsSync(path), true);
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  assert.deepEqual(parsed.items[0], { id: 1, text: 'x', done: false });
  rmSync(dir, { recursive: true });
});
test('T5_load_returns_empty_state_when_file_missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
  const path = join(dir, 'nonexistent.json');
  const s = todo.load(path);
  assert.deepEqual(s, { items: [] });
  rmSync(dir, { recursive: true });
});
test('T5_save_then_load_roundtrips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
  const path = join(dir, 'state.json');
  const original = { items: [{ id: 1, text: 'a', done: false }, { id: 2, text: 'b', done: true }] };
  todo.save(original, path);
  const loaded = todo.load(path);
  assert.deepEqual(loaded, original);
  rmSync(dir, { recursive: true });
});

// ---------- T6: formatJson ----------
test('T6_formatJson_returns_parseable_json', () => {
  const s = { items: [{ id: 1, text: 'x', done: false }] };
  const out = todo.formatJson(s);
  const parsed = JSON.parse(out);
  assert.deepEqual(parsed.items[0], { id: 1, text: 'x', done: false });
});
test('T6_formatJson_empty_state', () => {
  const out = todo.formatJson({ items: [] });
  const parsed = JSON.parse(out);
  assert.deepEqual(parsed.items, []);
});

// ---------- T7: runCli ----------
// runCli is the dispatcher. Use a fresh tmp file per test to isolate state.
test('T7_cli_add_then_list_shows_item', () => {
  const dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
  const path = join(dir, 'state.json');
  let r = todo.runCli(['add', 'buy milk'], { todoFile: path });
  assert.equal(r.exitCode, 0);
  r = todo.runCli(['list'], { todoFile: path });
  assert.equal(r.exitCode, 0);
  assert.match(r.stdout, /buy milk/);
  rmSync(dir, { recursive: true });
});
test('T7_cli_complete_marks_done', () => {
  const dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
  const path = join(dir, 'state.json');
  todo.runCli(['add', 'a'], { todoFile: path });
  const r = todo.runCli(['complete', '1'], { todoFile: path });
  assert.equal(r.exitCode, 0);
  const s = todo.load(path);
  assert.equal(s.items[0].done, true);
  rmSync(dir, { recursive: true });
});
test('T7_cli_remove_drops_item', () => {
  const dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
  const path = join(dir, 'state.json');
  todo.runCli(['add', 'a'], { todoFile: path });
  const r = todo.runCli(['remove', '1'], { todoFile: path });
  assert.equal(r.exitCode, 0);
  const s = todo.load(path);
  assert.equal(s.items.length, 0);
  rmSync(dir, { recursive: true });
});
test('T7_cli_json_flag_outputs_json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
  const path = join(dir, 'state.json');
  todo.runCli(['add', 'x'], { todoFile: path });
  const r = todo.runCli(['list', '--json'], { todoFile: path });
  assert.equal(r.exitCode, 0);
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.items[0].text, 'x');
  rmSync(dir, { recursive: true });
});
test('T7_cli_unknown_command_nonzero_exit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
  const path = join(dir, 'state.json');
  const r = todo.runCli(['frobnicate'], { todoFile: path });
  assert.notEqual(r.exitCode, 0);
  rmSync(dir, { recursive: true });
});
test('T7_cli_complete_missing_id_nonzero_exit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
  const path = join(dir, 'state.json');
  const r = todo.runCli(['complete', '99'], { todoFile: path });
  assert.notEqual(r.exitCode, 0);
  rmSync(dir, { recursive: true });
});
