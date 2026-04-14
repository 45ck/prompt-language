# H12: Security Vulnerability Fix — SQL Injection

## Task

The Express API in `src/app.js` has a SQL injection vulnerability in the search endpoint. Fix all SQL queries to use parameterized queries instead of string concatenation.

## Acceptance Criteria

1. No SQL query uses string concatenation or template literals to insert user input
2. All queries use parameterized placeholders (`?` for SQLite)
3. The search endpoint returns correct results for normal queries
4. The application handles SQL injection attempts safely (returns empty results or error, not injected data)
5. All existing functionality still works after the fix
