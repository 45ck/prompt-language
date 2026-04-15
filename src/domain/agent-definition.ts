/**
 * AgentDefinition — a named, reusable spawned-child configuration.
 *
 * An agent controls what a spawned session *is*: its model, profile,
 * variable-passing policy, and working directory. Agents are declared
 * in the `agents:` section of a flow file and referenced on spawn lines
 * via `spawn "name" as <agentName>`.
 */

export interface AgentDefinition {
  readonly name: string;
  readonly model?: string | undefined;
  readonly profile?: string | undefined;
  readonly skills?: readonly string[] | undefined;
}

export type AgentRegistry = Readonly<Record<string, AgentDefinition>>;

export function createAgentDefinition(
  name: string,
  model?: string,
  profile?: string,
  skills?: readonly string[],
): AgentDefinition {
  return {
    name,
    ...(model != null ? { model } : {}),
    ...(profile != null ? { profile } : {}),
    ...(skills != null && skills.length > 0 ? { skills } : {}),
  };
}
