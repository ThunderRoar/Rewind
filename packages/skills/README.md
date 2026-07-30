# @rewind/skills — Agent Skills

Portable, model-agnostic skills (in the standard `SKILL.md` frontmatter format) that teach any agent to use Rewind and CockroachDB well. Drop a skill folder into an agent's skills directory and it loads on relevance.

| Skill | Use it when |
|---|---|
| [`rewind-self-instrument`](rewind-self-instrument/SKILL.md) | Instrumenting a new agent to record its decisions/tools/memory into Rewind. |
| [`cockroach-memory-patterns`](cockroach-memory-patterns/SKILL.md) | Designing an agent's durable, searchable memory layer on CockroachDB. |
| [`postmortem-writer`](postmortem-writer/SKILL.md) | Investigating an agent incident and drafting a grounded postmortem. |

Each `SKILL.md` has `name` + `description` frontmatter (for relevance matching) and concrete, verifiable instructions — no filler. The `postmortem-writer` skill drives the whole Rewind loop (timeline → find_similar_failures → fork/replay attribution), so an agent can run an incident investigation end-to-end.
