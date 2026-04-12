# Interventions

1. The sequential lane was rerun against the patched runtime after fixes for state-root resolution,
   headless run-node timeout defaults, and Codex prompt-runner process handling.
2. The run used an absolute `--state-dir` path, which now completed successfully and populated the
   persisted state under `pl-state/`.
3. The parent shell command had been interrupted earlier, so `ci-report.json` and `ci-stderr.log`
   remained empty. The authoritative evidence for this run is `pl-state/session-state.json` plus
   `pl-state/audit.jsonl`.
4. The background run later completed cleanly, and no matching A05 prompt-runner processes remained
   alive afterward.
