# Session findings — opencode runner + qwen3-opencode:30b on Next.js scaffold

Date: 2026-04-20
Host: Windows 11, `ajax@aquinus.net`, opencode.exe via WinGet, ollama local
Scope: live session driving opencode through prompt-language to scaffold and build a Next.js 15 App Router app, start-to-finish. Complements [`LOCAL-MODEL-VIABILITY-FINDINGS.md`](LOCAL-MODEL-VIABILITY-FINDINGS.md).

## TL;DR

- Opencode + local `qwen3-opencode:30b` + prompt-language can produce a buildable Next.js app end-to-end, but only after three infrastructure fixes below.
- All three fixes are outside of user prompting — they are pure runtime/config defects that silently cause opencode to "work" but produce nothing, or to return tool-free text replies.
- Model correctness is the remaining problem once infra is fixed: qwen3-opencode:30b scaffolded six files correctly but inserted a stray `jsxImportSource: "@emotion/react"` in `tsconfig.json` that broke `next build` until a human (or retry loop) removed it.

## Infrastructure defects fixed this session

### 1. Ollama Modelfile `num_ctx` silently truncates opencode's system prompt

Symptom: opencode emits `"I attempted to use bash.execute when I should have used bash"` or `"no tools available"`. Tool registry logs show bash/read/write/edit all loaded.

Root cause: `qwen3-opencode:30b` ships with `PARAMETER num_ctx 8192`; `gemma4-opencode-vulkan:31b` ships with `PARAMETER num_ctx 4096`. Opencode's system prompt + tool definitions with skills enabled exceeds 4K; once the model's tool list gets truncated the model either hallucinates tool names or denies having tools. The `"limit": { "context": 32768 }` in `opencode.json` is metadata only — it does not override the Modelfile.

Fix: create a Modelfile variant with the full context:

```
FROM qwen3-opencode:30b
PARAMETER num_ctx 32768
PARAMETER temperature 0.3
```

`ollama create qwen3-opencode-big:30b -f Modelfile.qwen3-big`. Verify with `curl http://127.0.0.1:11434/api/ps` — `context_length` must equal the bumped value.

### 2. Opencode's skill catalog bloats the system prompt for local models

Symptom: even at 32K ctx, the model responds with "My capabilities are limited to the tools listed in the provided skill catalog" and lists dozens of doc/analysis skills (`abuse-case-writer`, `acceptance-criteria-writer`, ...) rather than invoking bash/write.

Root cause: opencode enumerates every skill in `~/.claude/skills/**` and `~/.agents/skills/**` as an action on the `skill` tool. On this host that is 300+ skills, each with a description. A 30B local model treats the flood of skill tools as the entire action space and forgets bash/write exist.

Fix: in the user's `opencode.json`, disable the `skill` tool for the default agent:

```jsonc
"agent": {
  "build": {
    "mode": "primary",
    "tools": {
      "skill": false,
      "bash": true, "read": true, "write": true, "edit": true,
      "glob": true, "grep": true, "webfetch": true,
      "task": true, "todowrite": true
    }
  }
}
```

### 3. Prompt-language `opencode` runner: progress detector is stale against current opencode output

Symptom: `[prompt-language run] FAILED — Prompt runner completed without observable workspace progress`, even though opencode wrote files to disk in the JSON event stream.

Root cause: `dist/infrastructure/adapters/opencode-prompt-turn-runner.js :: summarizeOpenCodeJsonOutput` only considers the run to have made progress when both `step_start.part.snapshot` **and** `step_finish.part.snapshot` appear **and differ**. Current `opencode run --format json` does not emit `part.snapshot` fields on those events at all, so `madeProgress` is always `false`. A second bug compounds this: `scheduleStepFinishResolution` only short-circuits when `madeProgress === undefined`, but the function never returns `undefined` under current opencode output, so a 1-second kill timer fires on the first stdout chunk. End result: opencode's turn is terminated within ~1 s of its first output.

Fix (applied in `dist/.../opencode-prompt-turn-runner.js`):

- Return `madeProgress = undefined` until a conclusive `step_finish` event with `reason: "stop"` is seen, so the kill-timer logic works as originally designed.
- Also treat any completed `tool_use` event for `write | edit | patch | multi_edit | notebook_edit` as evidence of progress, independent of the missing snapshot fields.

This is a compatibility drift, not a config issue — the detector was written against an older opencode JSON schema.

## Observed end-to-end behaviour after fixes

- Opencode `run --pure --format json --dangerously-skip-permissions --dir <cwd>` with a file-creation prompt reliably emits `tool_use` events for `write`/`bash` and a final `step_finish reason="stop"`.
- `qwen3-opencode:30b` at 32K ctx takes **~3 min per single-file scaffold prompt** and **~13 min for a six-file scaffold + `npm install` + `next build` in a single prompt turn**. The long-turn version hit prompt-language's default `PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS=90000` and needed it raised to 900000.
- Model-correctness regression: qwen3-opencode:30b added `@emotion/react` to `package.json` and set `compilerOptions.jsxImportSource: "@emotion/react"` in `tsconfig.json` despite the prompt explicitly saying "do not add any other dependencies". This broke `next build` with `f.createContext is not a function`. Removing `jsxImportSource` and switching `jsx: "preserve"` fixed the build.
- This is the motivation for flow v2: split into six 1-file scaffold prompts + `run: npm install` + `retry max 3 { run: next build; if command_failed { prompt: fix it } }` — lets prompt-language supervise the build gate and ask opencode to self-heal.

## Artifacts produced

- `C:\Users\MQCKENC\.config\opencode\Modelfile.qwen3-big` — 32K-ctx Modelfile variant.
- `C:\Users\MQCKENC\.config\opencode\opencode.json` — full-allow permissions, skill tool disabled, multi-model ollama provider.
- `dist/infrastructure/adapters/opencode-prompt-turn-runner.js` — patched `summarizeOpenCodeJsonOutput` (NOT yet ported to `src/…ts`).
- `C:\Projects\oc-nextjs-test\` — v1 flow, scaffold + install + partial build, `BUILD_ID=SXThtzYJjxhWF0RMIDnIH` after human-fixed `tsconfig.json`.
- `C:\Projects\oc-nextjs-v2\build.flow` — v2 split flow with `retry max 3 … if command_failed` self-heal loop, run in progress at time of writing.

## Open questions / next checks

- Port `summarizeOpenCodeJsonOutput` fix to `src/infrastructure/adapters/opencode-prompt-turn-runner.ts` and update tests. Current patch only lives in `dist/` and will be overwritten by the next `npm run build`.
- Does `retry max 3 + if command_failed + prompt: fix it` actually cause qwen3-opencode:30b to remove the `jsxImportSource` line, or does it re-add the same dependency? v2 flow test in flight.
- Does raising `num_ctx` further (e.g. 65536) materially change correctness on multi-file scaffolds, or only throughput?
- Is there a smaller-active-param opencode-tuned model on this host that also produces valid React/TS + calls `write` reliably? The pure-30B run took 13 min for a task that opencode via a frontier model would finish in under 30 s.
