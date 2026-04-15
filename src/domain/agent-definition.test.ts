import { describe, it, expect } from 'vitest';
import { createAgentDefinition } from './agent-definition.js';

describe('createAgentDefinition', () => {
  it('creates minimal agent with name only', () => {
    const agent = createAgentDefinition('worker');
    expect(agent).toEqual({ name: 'worker' });
  });

  it('creates agent with model', () => {
    const agent = createAgentDefinition('reviewer', 'opus');
    expect(agent).toEqual({ name: 'reviewer', model: 'opus' });
  });

  it('creates agent with all fields', () => {
    const agent = createAgentDefinition('full', 'sonnet', 'security-expert', ['lint', 'test']);
    expect(agent).toEqual({
      name: 'full',
      model: 'sonnet',
      profile: 'security-expert',
      skills: ['lint', 'test'],
    });
  });

  it('omits empty skills array', () => {
    const agent = createAgentDefinition('worker', 'opus', undefined, []);
    expect(agent).toEqual({ name: 'worker', model: 'opus' });
    expect(agent).not.toHaveProperty('skills');
  });

  it('omits undefined optional fields', () => {
    const agent = createAgentDefinition('worker', undefined, undefined, undefined);
    expect(agent).toEqual({ name: 'worker' });
    expect(agent).not.toHaveProperty('model');
    expect(agent).not.toHaveProperty('profile');
    expect(agent).not.toHaveProperty('skills');
  });
});
