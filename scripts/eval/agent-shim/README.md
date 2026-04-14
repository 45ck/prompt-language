# pl-agent-shim (independent-witness wrapper)

This directory contains the shim binaries that wrap each real agent CLI
(`claude`, `codex`, `gemini`, `ollama`, `opencode`). The shim is an
independent witness of every agent invocation: it records argv, cwd,
stdin/stdout SHA-256 digests, pid, exit code, binary path + hash, and
wall-clock duration to a hash-chained JSONL trace, then execs the real
binary transparently.

The PL runtime writes its own chained trace describing the same
invocations from its point of view. The verifier
(`scripts/eval/verify-trace.mjs`) cross-checks the two sides: every
`agent_invocation_begin/end` the runtime claims must have a matching
`shim_invocation_begin/end` with the same pid, argv, and stdinSha256.
If either side lies (or skips a call), the check fails.

## Files

- `pl-agent-shim.mjs` — the shim implementation (Node, stdlib only).
- `pl-claude.cmd`, `pl-codex.cmd`, `pl-gemini.cmd`, `pl-ollama.cmd`,
  `pl-opencode.cmd` — Windows forwarders that resolve the per-binary
  real path and invoke the shim under the right identity.
- `pl-agent-shim` — Unix forwarder. Symlink `claude`, `codex`, etc. to
  this script and the shim will pick up `PL_SHIM_NAME` from the
  invocation basename.
- `.binary-cache.json` — per-binary sha256 cache keyed by mtime. Only
  written when `PL_SHIM_TRUST_CACHE=1` is set (see "Security: binary
  identity" below). Gitignored; never check in.

## Environment contract

| Var                  | Required                        | Meaning                                                                                                             |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `PL_RUN_ID`          | yes (shim exits 2 if missing)   | Run id that ties shim and runtime traces together.                                                                  |
| `PL_TRACE_DIR`       | no (default `.prompt-language`) | Directory containing `provenance.jsonl`. Relative to cwd.                                                           |
| `PL_REAL_BIN`        | yes                             | Absolute path to the real binary to exec.                                                                           |
| `PL_SHIM_NAME`       | no                              | Short identity (e.g. `claude`) written into the trace.                                                              |
| `PL_REAL_BIN_<NAME>` | yes for per-name stubs          | Windows `.cmd` stubs read `PL_REAL_BIN_CLAUDE`, `PL_REAL_BIN_CODEX`, etc. and populate `PL_REAL_BIN` automatically. |
| `PL_SHIM_TRUST_CACHE`| no (default unset)              | When set to `'1'`, re-enables the legacy mtime-keyed binary hash cache. Any other value (including unset) forces always-compute. Dev-only; see "Security: binary identity". |

## Install on Windows

1. Put this directory on `PATH` ahead of the real agent binaries.
2. Export the per-binary real paths, for example:
   ```
   set PL_REAL_BIN_CLAUDE=C:\Users\me\AppData\Local\Programs\claude\claude.cmd
   set PL_REAL_BIN_OLLAMA=C:\Program Files\Ollama\ollama.exe
   ```
3. Export `PL_RUN_ID` for the current session.
4. Invoke `claude` (or any wrapped binary) normally. The `.cmd` stubs are
   named so PATH-resolution picks them up.

## Install on Linux/macOS

1. Copy or symlink `pl-agent-shim` into a directory on `PATH`.
2. Create per-binary symlinks that share the target:
   ```
   ln -s pl-agent-shim claude
   ln -s pl-agent-shim codex
   ln -s pl-agent-shim gemini
   ln -s pl-agent-shim ollama
   ln -s pl-agent-shim opencode
   ```
3. Export `PL_RUN_ID` and either `PL_REAL_BIN` or per-name
   `PL_REAL_BIN_CLAUDE` etc.
4. The shim identity is derived from the invocation basename, so the
   symlink names matter.

## Trace format

Each line in `provenance.jsonl` is a canonical JSON record. Shim-authored
records have `source: "shim"` and use events `shim_invocation_begin` and
`shim_invocation_end`. The hash chain is shared with runtime records, so
seq numbers are monotonic across both sources and `prevEventHash` always
points at the preceding entry in the file regardless of who wrote it.

See `scripts/eval/provenance-schema.mjs` for the authoritative schema
and chain helpers, and `scripts/eval/verify-trace.mjs` for the
cross-check.

## Why this design

- The shim is the only component that sees the real subprocess boundary,
  so its records are hard to forge from inside the runtime.
- It records hashes of stdin and stdout rather than their contents, so
  the trace stays small and does not capture prompts verbatim.

## Security: binary identity (AP-4)

The shim records `binarySha256` so the verifier and downstream witness
chain can prove which binary actually ran. Earlier versions cached that
hash in `.binary-cache.json` keyed on `(path, mtimeMs)` to avoid
rehashing on every invocation. That cache is defeatable:

```js
// Attacker with write access to the real binary on the host:
const t = fs.statSync('claude').mtime;
fs.writeFileSync('claude', '...malicious...');
fs.utimesSync('claude', t, t); // restore mtime
```

On the next shim invocation the cache hit returns the old honest
SHA-256 for a now-malicious binary, and the witness chain silently
validates a swapped binary. An attacker who can overwrite the binary
can already do a lot, but the point of the shim trace is to produce an
independent record that catches exactly this kind of substitution.

**Default behavior (AP-4 fix):** the shim never reads or writes
`.binary-cache.json`. Every invocation reads `PL_REAL_BIN` end-to-end
and computes a fresh SHA-256. For a ~40 MB binary on SSD this is well
under 100 ms, which is negligible compared to the agent call itself.
The shim logs `[shim] binary-hash-mode: always-compute` to stderr once
per process so operators can confirm the mode.

**Opt-in (dev only):** set `PL_SHIM_TRUST_CACHE=1` to restore the
legacy mtime-keyed cache. Use only on fully-trusted local loops where
the binary cannot be swapped between invocations and where hashing cost
is actually a bottleneck. In this mode the shim logs
`[shim] binary-hash-mode: cached`. Do not set this variable on CI,
shared runners, or any environment that participates in the
witness-chain trust story.

The cache file is gitignored. If you ever find `.binary-cache.json`
tracked in git, delete it — a committed cache is both noise and a
rollback hazard for this exact attack.
