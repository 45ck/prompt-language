# Example: Retry with Backoff

Add delays between retry attempts to handle rate-limited APIs, flaky services, or resource contention. Uses shell arithmetic for exponential backoff.

## Natural language

```
Call the deployment API. If it fails, wait before retrying — start with 1 second and double the wait each time. Try up to 5 times.
```

## DSL equivalent

```
Goal: deploy with exponential backoff

flow:
  let delay = "1"
  retry max 5
    run: curl -sf https://api.example.com/deploy -X POST
    if command_failed
      run: sleep ${delay}
      let delay = run "echo $((${delay} * 2))"
      prompt: The deployment request failed after waiting ${delay}s. Analyze the error and adjust the request if needed.
    end
  end

done when:
  file_exists deploy/DEPLOYED
```

## What happens

1. `let delay = "1"` initializes the backoff delay to 1 second.
2. `retry max 5` enters the body and runs the curl command.
3. If the request fails, the `if` block activates:
   - `run: sleep ${delay}` waits before retrying (1s, 2s, 4s, 8s, 16s).
   - `let delay = run "echo $((${delay} * 2))"` doubles the delay for the next attempt using shell arithmetic.
   - The agent gets a prompt to analyze the error and potentially adjust the request.
4. On the next retry iteration, the delay is longer, giving the service time to recover.
5. The gate ensures the deployment actually succeeded — the agent can't just claim it worked.

## Variation: backoff with maximum cap

Cap the delay at 30 seconds to avoid excessively long waits:

```
flow:
  let delay = "2"
  retry max 5
    run: curl -sf https://api.example.com/deploy -X POST
    if command_failed
      run: sleep ${delay}
      let delay = run "echo $(( ${delay} * 2 > 30 ? 30 : ${delay} * 2 ))"
    end
  end

done when:
  file_exists deploy/DEPLOYED
```

## Variation: fixed delay (no escalation)

For simpler cases where a constant delay is sufficient:

```
flow:
  retry max 3
    run: npm publish
    if command_failed
      run: sleep 5
      prompt: Publish failed. Check if there's a version conflict or network issue.
    end
  end
```

No variable tracking needed — just a fixed `sleep 5` between attempts.
