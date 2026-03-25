# Example: Process Files with Foreach

Use `foreach` to iterate over a dynamic list of files from a shell command. Each iteration processes one file with full access to the loop variable and index.

## Natural language

```
Find all TypeScript files that have TODO comments, then fix each one. Run the type checker after each fix.
```

## DSL equivalent

```
Goal: resolve all TODO comments

flow:
  let todo_files = run "grep -rl 'TODO' src/ --include='*.ts'"
  foreach file in ${todo_files}
    prompt: Open ${file} and resolve all TODO comments. Replace each TODO with a proper implementation.
    run: npx tsc --noEmit
  end

done when:
  tests_pass
```

## What happens

1. `let todo_files = run "grep -rl ..."` executes the grep command and stores the newline-delimited list of file paths in the `todo_files` variable. This auto-advances.
2. `foreach file in ${todo_files}` splits the variable into items. The split priority is: JSON array first, then newline-delimited, then whitespace-delimited. Since `grep -rl` outputs one path per line, the newline split applies.
3. On each iteration, `${file}` is set to the current file path. Auto-variables `${file_index}` (zero-based) and `${file_length}` (total count) are also available.
4. The prompt tells Claude which specific file to work on. The `run: npx tsc --noEmit` verifies no type errors were introduced.
5. After all files are processed, the `done when: tests_pass` gate runs the full test suite.

## Key design points

**Dynamic lists**: The file list comes from a real command, not a hardcoded literal. If `grep` finds 7 files, the loop runs 7 times. If it finds 0, the body is skipped entirely.

**Per-iteration verification**: Running `npx tsc --noEmit` inside the loop catches type errors immediately after each file change, rather than discovering them all at the end. This keeps fixes incremental.

**Auto-variables**: Inside the loop body, `${file_index}` gives the zero-based position and `${file_length}` gives the total count. These are useful for progress tracking: "Processing file 3 of 7."

## Variation: accumulate results into a list

Use `let x += run` inside a loop to build a list of outputs:

```
Goal: audit all config files

flow:
  let configs = run "find . -name '*.config.js' -not -path './node_modules/*'"
  let issues = []
  foreach cfg in ${configs}
    let check = run "node audit.js ${cfg}"
    let issues += "${check}"
  end
  prompt: Here are the audit results for all config files: ${issues}. Write a summary report.
```

After the loop, `${issues}` contains a JSON array of all individual audit results. The `${issues_length}` auto-variable holds the count.

## Variation: nested foreach

Process a matrix of combinations:

```
Goal: test all environments

flow:
  foreach env in "dev staging prod"
    foreach region in "us-east eu-west ap-south"
      run: deploy --env ${env} --region ${region} --dry-run
    end
  end
```

The outer loop iterates over environments, the inner loop over regions. Each combination gets a dry-run deployment. The iteration limit defaults to 50 per loop, so nested loops with large lists should set explicit `max` values.
