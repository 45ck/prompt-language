# Example: Parallel Review of Changed Files

Use `foreach-spawn` to fan out over changed files, run one child per file, do focused checks inside each child, then aggregate the results after `await all`. This complements the shipped `foreach-spawn` behavior described in the reference docs rather than redefining it.

## Natural language

```
Review every changed source file in parallel. Give each file its own child, run a focused test or lint command for that file, then wait for all reviews and write one combined summary.
```

## DSL equivalent

```yaml
Goal: review changed files in parallel

flow:
  let files = run "git diff --name-only -- '*.ts' '*.tsx' '*.js'"
  foreach-spawn file in ${files} max 20
    prompt: Review ${file} for correctness, risky changes, and missing tests. Keep the review scoped to this file.
    run: npm test -- ${file}
    let review_summary = run "printf 'reviewed %s\n' '${file}'"
  end
  await all
  prompt: Aggregate the per-file review results and write one concise summary for the parent. Reviewed files: ${files}

done when:
  tests_pass
```

## What happens

1. `let files = run` collects the changed source files from git as a newline-delimited list.
2. `foreach-spawn file in ${files}` launches one child per file, so review work fans out immediately instead of running serially.
3. Each child gets its own `${file}` value and stays narrowly scoped to that file's review.
4. `run: npm test -- ${file}` keeps verification targeted. Each child checks only the file it owns instead of running the full suite.
5. `await all` acts as the barrier. The parent does not aggregate until every per-file review child has finished.
6. The final parent prompt combines the individual results into one summary after the fan-out completes.

## Variation: collect focused test output per file

If each child should return a structured result for parent-side aggregation, have the child write a short per-file summary and combine those after `await all`:

```yaml
flow:
  let files = run "git diff --name-only -- '*.ts'"
  foreach-spawn file in ${files} max 10
    run: npm test -- ${file}
    let review_summary = "PASS ${file}"
  end
  await all
  prompt: Summarize all child review summaries and identify any files that still need follow-up.
```
