# Agent memory — portable copy

These files are a **copy** of the assistant's persistent memory for this project, kept in
the repo so they survive a machine change, a fresh checkout, or a different agent picking
the work up.

## What they are

| File | Holds |
|---|---|
| `MEMORY.md` | The index. One line per memory. |
| `astera.md` | What this project is, where it lives, and that the design phase is **over**. |
| `user-execution-mode.md` | How the owner wants work done: decide small things yourself, ship, ask only on core product direction. |
| `user-code-quality-bar.md` | Full typing, zero lint errors, tests for everything, root cause before fixing a test. |

## They are not the source of truth

**`../../CLAUDE.md` and `../../docs/` outrank everything here.** Those were audited against
the code; memory is a pointer, deliberately thin, and exists to make sure a cold session
*reads them* rather than reconstructing the project from guesswork.

If memory and the docs ever disagree, the docs win and the memory is stale.

## Restoring it in a new environment

Claude Code stores memory per working directory, under
`~/.claude/projects/<slugified-cwd>/memory/`. For this project, working from the repo root:

```bash
mkdir -p ~/.claude/projects/-home-yildirim-Desktop-Coding-MyProjects-blindspace/memory
cp .claude/memory/*.md ~/.claude/projects/-home-yildirim-Desktop-Coding-MyProjects-blindspace/memory/
```

Adjust the slug if the repo lives somewhere else: it is the absolute path with `/` replaced
by `-`.

**Even without this step the project is resumable** — `CLAUDE.md` loads automatically from
the repo root and carries the operating manual. Memory only adds the owner's cross-project
working preferences.
