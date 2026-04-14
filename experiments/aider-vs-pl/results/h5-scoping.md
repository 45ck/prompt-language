# H5: File Scoping Prevents Breakage - PL WINS

- Solo: 0/3 tests pass after refactor (timestamp prefix broke assertions)
- PL: 3/3 tests pass after 1 retry (updated assertions to stringContaining)
- Solo had test file out of scope — no path to recovery
- PL's retry loop with both files enabled the fix
