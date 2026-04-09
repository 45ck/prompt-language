# Proposed DSL Examples

These are **proposed** examples, not current Prompt Language syntax.

## 1. Knowledge loading

```yaml
knowledge:
  startup:
    - './CLAUDE.md'
    - './policies/engineering.md'

  on_demand:
    - './docs/**/*.md'
    - './services/**/CLAUDE.md'

  imports: true
```

## 2. Exact section lookup

```yaml
flow:
  let auth_rules = section "./CLAUDE.md#Authentication rules"
  let rollback = section "./docs/runbooks/deploy.md#Rollback"

  prompt: |
    Follow these auth rules:
    ${auth_rules}

    If deployment changes are required, the rollback procedure is:
    ${rollback}
```

## 3. Scoped memory and strict reads

```yaml
memory: require project.release_rule
  optional user.preferences
  optional project.test_cmd default="npm test"

flow: remember scope=project key="release_rule" value="Always include rollback steps"
```

## 4. Read-only policy vs writable memory

```yaml
policy:
  memory:
    'org/*':
      read: all
      write: approved_only

    'user/*':
      read: all
      write: agent

    'run/*':
      read: self
      write: self
```

## 5. Checkpoints and replay

```yaml
session:
  thread_id "${ticket_id}"
  checkpoint every_step
  summary_key "running_summary"

flow:
  checkpoint "before_migration"

  run: npm test
  run: npm run migrate

  checkpoint "after_migration"

  if ask "does the migration look unsafe?" grounded-by "npm test"
    replay from "before_migration"
    prompt: Rework the migration with a rollback plan.
  end
```

## 6. Summarization / compaction

```yaml
session: summarize when tokens > 12000
  keep_last_messages 6
  store_summary in run.summary
```

## 7. Abstract retrieval

```yaml
flow:
  let docs = retrieve
    from "./docs/**/*.md"
    query "rollback procedure billing migration"
    mode hybrid
    top 5
    filters {
      type: ["runbook", "postmortem"]
      service: ["billing"]
    }
```

## 8. Background consolidation

```yaml
maintenance: consolidate scope="user/profile" schedule="daily"
  merge_duplicates true
  resolve_conflicts "latest_verified"
```

## 9. Support-agent style combined example

```yaml
Goal: resolve a returning customer issue without making them repeat themselves

knowledge:
  startup:
    - "./CLAUDE.md"
    - "./policy/support.md"
  on_demand:
    - "./runbooks/**/*.md"
    - "./products/**/*.md"

memory:
  require user.profile
  optional user.preferences
  optional user.chat_summary

session:
  thread_id "${ticket_id}"
  checkpoint every_step
  summarize when tokens > 10000
  keep_last_messages 6

policy:
  memory:
    "org/*":
      read: all
      write: approved_only
    "user/*":
      read: all
      write: agent

flow:
  let prior_context = recall contextual
    scope=user.chat_summary
    based_on=${messages}
    top=3

  let refund_policy = section "./policy/support.md#Refunds"

  prompt: |
    Use the stored customer profile and the prior conversation summaries.
    Follow the refund policy exactly:
    ${refund_policy}

  run: node tools/check-account-status.js ${customer_id}

  checkpoint "before_resolution"

  if ask "is a refund required?" grounded-by "node tools/check-account-status.js ${customer_id}"
    approve "Issue refund for ${customer_id}?" timeout 300
  end

  remember scope="user/chat_summary"
    key="${ticket_id}"
    value="Customer contacted support about duplicate billing; account checked; resolution proposed."
    on="success"

done when:
  gate resolved: node tools/verify-ticket-closed.js ${ticket_id}
```
