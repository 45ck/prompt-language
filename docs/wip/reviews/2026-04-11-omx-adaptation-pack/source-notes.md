# Source Notes

This pack was grounded against the following public sources on 2026-04-11.

## prompt-language

1. Repository / README  
   https://github.com/45ck/prompt-language  
   https://github.com/45ck/prompt-language/blob/main/README.md

   Key grounding points used:
   - prompt-language is described as a supervised runtime / control-flow runtime
   - `done when:` is documented as the trust anchor
   - current CLI includes install, status, uninstall, init, validate, run, ci, demo, statusline, watch
   - packaged workflows are documented as examples, not the core feature
   - persistent state is currently surfaced via `.prompt-language/session-state.json`
   - runtime includes `spawn`, `await`, `approve`, `remember`, `import`, `use`, `ask ... grounded-by`, and a stable SDK

2. Roadmap  
   https://github.com/45ck/prompt-language/blob/main/docs/roadmap.md

   Key grounding points used:
   - the roadmap separates shipped, tracked next, and exploratory work
   - tracked WIP already includes registry, MCP, broader harness abstraction, LSP, playground, and workspace orchestration
   - docs truthfulness is a stated rule

3. WIP index  
   https://github.com/45ck/prompt-language/blob/main/docs/wip/index.md

   Key grounding points used:
   - imported packs are an accepted repo convention
   - `reviews/`, `swarm/`, and `vnext/` are already established pack categories

4. Review packs index  
   https://github.com/45ck/prompt-language/blob/main/docs/wip/reviews/index.md

   Key grounding points used:
   - `reviews/` is explicitly for external or conversation-derived assessment packs useful for backlog shaping

5. Swarm pack README  
   https://github.com/45ck/prompt-language/blob/main/docs/wip/swarm/README.md

   Key grounding points used:
   - swarm direction is explicitly constrained to lower to existing primitives
   - this influenced the team-supervisor recommendation

6. vNext pack README  
   https://github.com/45ck/prompt-language/blob/main/docs/wip/vnext/README.md

   Key grounding points used:
   - the repo already accepts zip-oriented spec packs with ADRs, specs, and rollout plans
   - this influenced the structure of this package

## oh-my-codex (OMX)

7. README  
   https://github.com/Yeachan-Heo/oh-my-codex/blob/main/README.md

   Key grounding points used:
   - OMX is a workflow layer for OpenAI Codex CLI
   - canonical workflow surfaces are `$deep-interview`, `$ralplan`, `$ralph`, `$team`
   - state is kept in `.omx/`
   - operator surfaces include setup, doctor, HUD, explore, sparkshell, and team lifecycle commands

8. AGENTS  
   https://github.com/Yeachan-Heo/oh-my-codex/blob/main/AGENTS.md

   Key grounding points used:
   - OMX treats AGENTS as a top-level operating contract
   - runtime markers and overlay discipline influenced the scaffolding recommendations

9. Changelog  
   https://github.com/Yeachan-Heo/oh-my-codex/blob/main/CHANGELOG.md

   Key grounding points used:
   - recent investment areas include native-hook preservation, HUD recovery, state operations, and team-runtime stability

10. Releases  
    https://github.com/Yeachan-Heo/oh-my-codex/releases

    Key grounding points used:
    - release notes reinforce that setup/hook preservation, HUD reconciliation, state CLI, and recovery are active operator concerns

## Interpretation rule used in this pack

This pack treats OMX as evidence of **operator-shell best practices**, not as a conceptual template for prompt-language identity.
