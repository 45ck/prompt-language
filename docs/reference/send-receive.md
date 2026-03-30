# send / receive

`send` and `receive` pass messages between spawned children and the parent process.

## Syntax

In the parent flow:

```yaml
send "worker" "Process batch ${batch_id}"
receive result from "worker" timeout 120
```

In a child flow (spawned as `"worker"`):

```yaml
receive task from parent
prompt: Process the task: ${task}
send parent "Done: ${result}"
```

With timeout:

```yaml
receive reply from "worker" timeout 30
```

## Semantics

- `send "target" "message"` writes the message to the target's inbox. `target` is a spawn name or `parent`.
- `receive varName` reads the oldest message from the inbox into `varName`. Blocks until a message arrives.
- `receive varName from "source"` filters by sender name.
- `receive varName from parent` uses the special keyword `parent` to filter messages from the parent process.
- `timeout N` on receive: if no message arrives within N seconds, continues with an empty string.

## Example

```yaml
# Parent
spawn "analyzer"
  receive task from parent
  prompt: Analyze this: ${task}
  let summary = prompt "Summarize your findings in one sentence"
  send parent ${summary}
end
send "analyzer" "Review the security model"
receive report from "analyzer" timeout 180
prompt: The analyzer reported: ${report}
```

## Related

- [spawn](spawn.md)
- [await](await.md)
- [let / var](let-var.md)
