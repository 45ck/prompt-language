# H18: Configuration System Redesign — Centralize Environment Variables

## Task

The application has `process.env` reads scattered across 5 files. Create a centralized config module that:

1. Reads all environment variables in one place
2. Provides defaults for optional variables
3. Validates required variables at startup
4. Exports a typed config object that other modules import

## Acceptance Criteria

1. A single `src/config.js` module exports all configuration
2. No other file reads `process.env` directly
3. All env vars have documented defaults
4. The app starts without any env vars set (uses defaults)
5. Missing required env vars produce a clear error message at startup
6. All existing functionality still works
