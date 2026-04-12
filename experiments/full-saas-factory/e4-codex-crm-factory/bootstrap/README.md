# Bootstrap Seeds

This directory contains the frozen workspace inputs for the patched E4 paired benchmark.

- `core-proof-seed/` is the neutral bounded-CRM scaffold shared by both lanes.
- `pl-overlay/` is the prompt-language-only overlay applied on top of the shared seed.

The paired runner hashes these directories before execution and records the hashes in the run
metadata so each lane can be tied to an explicit starter artifact.
