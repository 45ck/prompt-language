# Spec 004 — Typed state and artifacts

## Problem

Variables today are powerful but still relatively loose:

- flat/global scope
- string-first semantics
- structured capture still degrades into raw text in permissive modes
- artifacts like test reports and risk analyses are not fully first-class

The language needs a stronger artifact/dataflow model.

## Goals

- Introduce typed schemas
- Make captured artifacts first-class values
- Support compile-time and runtime validation
- Enable richer downstream analysis and contracts

## Non-goals

- This is not a full static type system for arbitrary computation
- This is not a general data processing DSL

## Proposed syntax

### Schema definitions

```yaml
schema RiskReport:
  summary: string
  risk: enum["low", "medium", "high"]
  touched_files: string[]
  rationale: string
end
```

### Strict typed capture

```yaml
let risk = prompt "Assess the diff risk" as RiskReport strict
```

### Artifact declarations

```yaml
artifact junit_report: JUnit = run "npm test -- --reporter=junit"
artifact risk_report: RiskReport = prompt "Assess the diff"
```

### Field access

```yaml
if ${risk.risk} == "high"
approve "High-risk diff. Continue?"
end
```

### Expectations

```yaml
expect artifact junit_report.failures == 0
expect artifact risk_report.risk != "high"
expect file "dist/report.json" matches ReportSchema
```

## Semantics

### `schema`

Named structure that can be used by captures, files, artifacts, contracts, and judges.

### `artifact`

A typed named result produced by:

- prompt
- run
- file read
- later judge/eval output

Artifacts differ from plain variables by being:

- typed
- auditable
- easier to replay
- easier to expose to analyzers and judges

### `expect`

A deterministic assertion over typed artifacts or files.
`expect` failures should be structured and replayable.

## Static analysis

The compiler/linter should:

- validate field access paths
- detect undefined schema references
- detect impossible expectations
- detect type mismatches between producer and consumer

## Migration path

### Phase 1

- named schemas
- strict typed prompt capture
- file schema validation

### Phase 2

- typed artifacts from run outputs
- built-in report adapters (JUnit, JSON, etc.)

### Phase 3

- artifact-aware contracts and judges

## Acceptance criteria

- Schemas can be defined and referenced
- Typed capture can fail closed
- Files can be validated against schemas
- Artifact fields can be accessed safely
- Expectations are structured and replayable

## Open questions

- Should schemas allow custom validators beyond structural shape?
- Should artifact typing be required in strict mode for critical downstream use?
