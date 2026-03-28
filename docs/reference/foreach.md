# foreach

`foreach` iterates over items in a list.

## Syntax

From a variable:

```yaml
foreach file in ${files}
  run: npx eslint ${file} --fix
end
```

From a literal:

```yaml
foreach env in "dev staging prod"
  run: deploy --target ${env}
end
```

From a command:

```yaml
foreach file in run "git diff --name-only -- '*.ts'"
  prompt: Fix ${file} without changing behavior.
end
```

## Sources it understands

- JSON arrays
- newline-delimited strings
- whitespace-delimited strings
- `run "..."` output

## Auto-set variables

- `${item}` current value
- `${item_index}` zero-based index
- `${item_length}` total item count

## Related

- [let / var](let-var.md)
- [continue](continue.md)
- [break](break.md)
