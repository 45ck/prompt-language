# Flow Registry

## Commands

```bash
npx @45ck/prompt-language run flows/fix-auth.flow
npx @45ck/prompt-language validate flows/fix-auth.flow
npx @45ck/prompt-language list
```

## Behavior

- `.flow` files become a standard convention
- `validate` parses, lints, and dry-runs a flow file
- `run` executes a flow file directly
- `list` discovers flow files in the project
