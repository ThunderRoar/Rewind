---
name: postmortem-writer
description: Use after an AI agent run fails or produces a bad outcome to write an incident postmortem. Walks the Rewind timeline (via its MCP tools or API) to find the root-cause event, checks for prior similar failures, and drafts a structured report. Apply when investigating an agent incident.
---

# Write an agent incident postmortem

When an agent run causes harm (a wrong action, a bad payout, a data leak), produce a postmortem grounded in the actual recorded run — not speculation.

## Investigate with Rewind

1. **Load the failing run's timeline** — `get_run(runId)` (MCP) or `GET /runs/:id`.
   Read events in `seq` order and find the last decision before the harmful action.
2. **Find the root-cause memory** — look for the `memory_read` the agent acted on.
   Poisoned or wrong memory is the most common root cause.
3. **Check for precedent** — `find_similar_failures(context)` (MCP) or
   `POST /similar-failures`. If this failure has siblings, it's a pattern, not a one-off.
4. **Confirm causation** — a fork + control/edited replay proves the root cause:
   if the control (unchanged) reproduces the failure and the edited (fixed memory)
   does not, the memory *caused* it.

## Draft (use this structure)

```
# Incident: <short title>
- Run: <runId> · Agent: <slug> · Detected: <when>
- Impact: <concrete harm, e.g. "$4,200 refunded to the wrong customer">

## Root cause
<the specific event — usually a poisoned/incorrect memory the agent trusted>

## Evidence
- Timeline: events #<n>..#<m>
- Attribution: control replay reproduced the outcome; edited replay (fixed memory) did not.
- Prior occurrences: <N> similar flagged failures.

## Fix
<what memory/tool/guardrail was changed>

## Prevention
Enable self-correction: have the agent query find_similar_failures before
high-risk actions so it refuses on recurrence.
```

## Rules

- Cite real event `seq` numbers and run ids; never invent them.
- State impact in concrete terms (money, records, users).
- End with a prevention step that is verifiable in Rewind (a replay or a self-correction check).
