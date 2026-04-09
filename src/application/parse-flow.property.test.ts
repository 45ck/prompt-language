import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseFlow } from './parse-flow.js';

function assertNoCrash(input: string): void {
  expect(() => parseFlow(input)).not.toThrow();
}

describe('parseFlow property tests', () => {
  it('does not crash on randomly assembled leaf-node flows', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(
            '  prompt: hello',
            '  run: echo ok',
            '  let x = "value"',
            '  var y = run "echo hi"',
            '  break',
            '  continue',
          ),
          { minLength: 1, maxLength: 24 },
        ),
        (lines) => {
          assertNoCrash(`flow:\n${lines.join('\n')}\n`);
        },
      ),
      { numRuns: 1000 },
    );
  }, 30_000);

  it('does not crash on prompt text with shell-special characters and unicode', () => {
    const specialChars = fc
      .array(fc.constantFrom('"', "'", '`', '$', '!', '\\', '{', '}', '|', '&'), {
        minLength: 0,
        maxLength: 24,
      })
      .map((chars) => chars.join(''));

    fc.assert(
      fc.property(
        fc.string({ maxLength: 40 }),
        specialChars,
        fc.string({ maxLength: 16 }),
        (a, specials, b) => {
          const promptText = `${a}${specials}${b} 你好 🎉`;
          assertNoCrash(`flow:\n  prompt: ${promptText}\n`);
        },
      ),
      { numRuns: 1000 },
    );
  }, 30_000);

  it('does not crash on indentation variations around simple flows', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 6 }),
        fc.constantFrom('prompt', 'run'),
        (flowIndent, bodyIndent, kind) => {
          const flowPad = ' '.repeat(flowIndent);
          const bodyPad = ' '.repeat(bodyIndent + 2);
          const line = kind === 'prompt' ? `${bodyPad}prompt: hello` : `${bodyPad}run: echo hello`;
          assertNoCrash(`${flowPad}flow:\n${bodyPad}${line.trimStart()}\n`);
        },
      ),
      { numRuns: 1000 },
    );
  }, 30_000);

  it('does not crash on deeply nested container flows', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), (depth) => {
        let flow = 'flow:\n';
        for (let i = 0; i < depth; i++) {
          const pad = '  '.repeat(i + 1);
          flow += `${pad}${i % 2 === 0 ? 'while not done max 2' : 'if tests_pass'}\n`;
        }
        flow += `${'  '.repeat(depth + 1)}prompt: leaf\n`;
        for (let i = depth - 1; i >= 0; i--) {
          flow += `${'  '.repeat(i + 1)}end\n`;
        }
        assertNoCrash(flow);
      }),
      { numRuns: 1000 },
    );
  }, 30_000);

  it('does not crash on long variable names and values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 160 }),
        fc.string({ maxLength: 512 }),
        (rawName, rawValue) => {
          const variableName = rawName.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') || 'x';
          const value = rawValue.replace(/\r/g, ' ').replace(/\n/g, ' ');
          assertNoCrash(`flow:\n  let ${variableName} = "${value}"\n`);
        },
      ),
      { numRuns: 1000 },
    );
  }, 30_000);
});
