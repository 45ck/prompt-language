import { writeFileSync, readFileSync, existsSync } from 'node:fs';
// todo.mjs — assembled by Concord/VHO routing pilot 2026-05-11.
// All function bodies start as throw-stubs; router fills them in per task.

export function add(state, text) {
  const maxId = state.items.reduce((m, it) => Math.max(m, it.id), 0);
  return { items: [...state.items, { id: maxId + 1, text, done: false }] };
}

export function list(state) {
  if (!state.items || state.items.length === 0) {
    return 'empty';
  }
  
  return state.items.map(item => {
    const status = item.done ? '[x]' : '[ ]';
    return `${status} ${item.id}: ${item.text}`;
  }).join('\n');
}

export function complete(state, id) {
  const newItem = state.items.map(item => 
    item.id === id ? { ...item, done: true } : item
  );
  
  if (newItem.length === state.items.length && 
      newItem.every((item, index) => item === state.items[index])) {
    throw new Error('Item not found');
  }
  
  return { items: newItem };
}

export function remove(state, id) {
  const items = state.items.filter(item => item.id !== id);
  if (items.length === state.items.length) {
    throw new Error('Item not found');
  }
  return { items };
}

export function save(state, path) {
  writeFileSync(path, JSON.stringify(state));
}

export function load(path) {
  if (!existsSync(path)) {
    return { items: [] };
  }
  const data = readFileSync(path, 'utf8');
  return JSON.parse(data);
}

export function formatJson(state) {
  return JSON.stringify(state, null, 2);
}

export function runCli(argv, opts = {}) {
  const todoFile = opts.todoFile || process.env.TODO_FILE || './.todo.json';
  const [command, ...rest] = argv;
  const isJson = rest.includes('--json');
  const args = rest.filter((a) => a !== '--json');
  try {
    let state = load(todoFile);
    switch (command) {
      case 'add': {
        if (!args[0]) return { exitCode: 1, stdout: '', stderr: 'usage: add <text>' };
        state = add(state, args.join(' '));
        save(state, todoFile);
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      case 'list': {
        const out = isJson ? formatJson(state) : list(state);
        return { exitCode: 0, stdout: out, stderr: '' };
      }
      case 'complete': {
        if (!args[0]) return { exitCode: 1, stdout: '', stderr: 'usage: complete <id>' };
        state = complete(state, parseInt(args[0], 10));
        save(state, todoFile);
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      case 'remove': {
        if (!args[0]) return { exitCode: 1, stdout: '', stderr: 'usage: remove <id>' };
        state = remove(state, parseInt(args[0], 10));
        save(state, todoFile);
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      default:
        return { exitCode: 1, stdout: '', stderr: `unknown command: ${command}` };
    }
  } catch (e) {
    return { exitCode: 1, stdout: '', stderr: e.message };
  }
}
