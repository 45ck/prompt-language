# H20: Documentation Generation — API Reference from Route Definitions

## Task

Generate a comprehensive API reference document (API.md) from the route definitions in `src/app.js`. The documentation must match the actual code — not be guessed or templated.

## Acceptance Criteria

1. An `API.md` file exists in the project root
2. Every route in src/app.js is documented (method, path, description)
3. Request body schema is documented for POST/PUT/PATCH routes
4. Response schema is documented for each route
5. At least one example request/response per route
6. The documentation matches the actual route definitions (no phantom routes)
