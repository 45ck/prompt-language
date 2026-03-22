# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in prompt-language, please report it responsibly.

**Do not open a public issue.** Instead, use [GitHub's private vulnerability reporting](https://github.com/45ck/prompt-language/security/advisories/new).

You should receive an acknowledgment within 48 hours. We will work with you to understand the scope and develop a fix before any public disclosure.

## Scope

prompt-language executes shell commands on behalf of the user via Claude Code. Security-relevant areas include:

- **Shell injection**: `shellInterpolate()` wraps variable values in single-quotes to prevent injection. Bypasses here are critical.
- **State file tampering**: `.prompt-language/session-state.json` is trusted input. Path traversal or content injection is relevant.
- **Plugin installation**: `bin/cli.mjs` copies files to `~/.claude/`. Supply chain or path traversal issues are relevant.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.2.x   | Yes       |
| < 0.2   | No        |
