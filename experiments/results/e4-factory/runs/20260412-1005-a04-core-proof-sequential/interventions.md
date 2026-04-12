# Interventions

1. A first sequential launch through `Start-Process` was invalid because Node again misread the script path under `D:\Visual Studio Projects\...`.
2. The valid rerun used direct invocation with the same relative `--state-dir` pattern that worked for `A03`.
3. The sequential run finished from the shell's perspective, but `ci-report.json` recorded a failed prompt-runner exit while the workspace had already produced most of the bounded CRM core artifacts.
4. The remaining sequential Codex child processes were observed but not terminated, to avoid killing active agents unnecessarily.
