# GSLR-2 Policy Schema Fixture

This fixture is a tiny code/schema task for governed local/frontier routing.
It is intentionally smaller than a production Portarium integration. The work
item is to implement one validator used by a hypothetical engineering-action
policy envelope.

The public gate checks normal positive and negative examples. The private
oracle checks edge cases that shallow implementations often miss, especially
recursive raw-payload leakage and budget/review evidence requirements.

Run the public gate:

```sh
npm test
```
