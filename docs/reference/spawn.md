# spawn

`spawn` launches a child flow in a separate Claude process.

## Syntax

```yaml
spawn "frontend"
  prompt: Fix the React component and its tests.
end
```

Cross-directory:

```yaml
spawn "backend" in "packages/api"
  run: npm test
end
```

Selective variable passing:

```yaml
spawn "frontend" with vars branch, sha
  prompt: Work from ${branch} at ${sha}.
end
```

## Semantics

- Each spawn creates a separate `claude -p` process.
- The child gets its own state directory.
- Parent variables are copied into the child at spawn time.
- The parent does not wait automatically.

## Limitations

- No nested spawn support.
- Children do not share variables with each other.
- Name collisions overwrite the earlier child entry.

## Related

- [await](await.md)
- [let / var](let-var.md)
