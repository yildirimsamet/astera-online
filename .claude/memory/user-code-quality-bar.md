---
name: user-code-quality-bar
description: "This user's non-negotiable bar — full typing, a linter, and tests for everything; untested code counts as unwritten"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 553ba8c9-2b15-4a5b-838b-03e499d77bd8
  modified: 2026-08-15T16:45:11.438Z
---

Stated directly, and treated as law on their projects:

> **Code without tests is code that was never written. It is unfinished work.**

- **Everything typed.** `any` is banned. No casts to silence the compiler.
- **A linter must be set up**, and its output must be zero. If a rule is wrong, change the
  rule deliberately — never learn to ignore it.
- **Every piece of code gets tests**, and tests must deliberately cover **edge cases**, not
  just the happy path: boundaries, malformed input, adversarial input, concurrency, failure,
  time.
- **When writing or fixing a test, find the root cause first.** Their exact instruction:
  *tests must not be forced to fit the code.* Establish whether the test or the code is wrong
  before changing either.

**Why:** they said it unprompted and in capitals-equivalent emphasis mid-project, after
watching the codebase grow. It is a standing rule, not a one-off request.

**How to apply:** run typecheck + lint + tests as one gate before claiming anything is done.
When several tests fail identically, that is one bug, not many. When a test is flaky —
e.g. betting on a probabilistic roll — that is a defect to fix, not noise to tolerate.
On Astera Online this is written up in `docs/engineering-standards.md`. See [[astera]].
