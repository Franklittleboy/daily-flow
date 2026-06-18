# Multi-Session Integration Guard Design

## Goal

Keep DailyFlow's parallel feature worktrees and lightweight feature previews while preventing accepted behavior and regression tests from disappearing silently during release integration.

The solution assigns about 70 percent of enforcement to deterministic scripts and 30 percent to short feature-session handoff rules. It must reduce manual AI review, preserve the existing preview commands, and avoid product behavior changes.

## Feature Session Responsibilities

Each normal feature session owns its product area and a dedicated acceptance test file:

| Branch | Product area | Acceptance test |
| --- | --- | --- |
| `feature/focus-page` | focus page, timing, task binding | `src/focus-page.test.js` |
| `feature/calendar-views` | month and week calendar views | `src/calendar-views.test.js` |
| `feature/task-detail-popover` | task detail, Markdown, attachments | `src/task-detail-popover.test.js` |
| `feature/mobile-layout` | mobile layout | `src/mobile-layout.test.js` |
| `feature/release-polish` | cross-feature integration decisions | `src/release-integration.test.js` |

Normal feature sessions may edit shared production files when their feature requires it, but they must not merge sibling feature branches, replace an integrated file wholesale, or decide which sibling behavior should be removed. Cross-area edits must be reported in the handoff.

When a feature is ready, its handoff records only four integration facts: branch, commit, acceptance test file, and shared production files changed. Ordinary Obsidian previews remain build-and-copy only.

## Release Preview Guard

`scripts/refresh-preview.mjs --release` will keep the current dirty-worktree check and add these deterministic phases before copying anything:

1. Record the release-polish commit, every included feature tip, and the latest semantic version tag.
2. Verify that the latest release tag is an ancestor of every included feature branch. If not, stop with the exact `sync-feature-base.mjs` command required.
3. Read the dedicated acceptance test file owned by each included branch and collect its test names.
4. Reset and merge the generated preview worktree as today.
5. Verify that every collected acceptance test name still exists in the merged preview. Missing contracts stop the run and identify the owning branch and test.
6. Compare feature changes since the latest release tag and print production files modified by more than one feature branch.
7. Run all tests, syntax checking, and the build.
8. Copy to Obsidian only after every previous phase succeeds.

The expected test set is calculated dynamically. No fixed test count is stored.

## Base Synchronization

After each published release, all normal feature branches must be synchronized to the new tag with:

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-feature-base.mjs --all --verify
```

The integration guard reports branches behind the latest tag instead of silently combining long-lived branches based on old source snapshots.

## Overlap Handling

Overlapping production files are a review signal, not an automatic failure. The report limits AI review to the shared files and the relevant feature contracts.

`feature/release-polish` is the only branch that resolves cross-feature behavior. Integration fixes must add or update `src/release-integration.test.js`. Conflict resolution is performed by behavior or code block, never by choosing an entire file because it was edited later.

## Exact GitHub State

The generated preview branch is disposable and is not pushed directly. After the user approves a full preview for GitHub:

1. The verified preview result is incorporated into `feature/release-polish` so the release-polish tree matches the tested product tree.
2. Tests, syntax checking, and the build run again on `feature/release-polish`.
3. The branch is pushed to GitHub.

This authorization does not move an existing tag, create a new tag, or create a GitHub Release unless the user explicitly requests those separate release actions.

## Files In Scope

- `scripts/refresh-preview.mjs`
- `scripts/sync-feature-base.mjs` only if a clearer base-sync diagnostic is needed
- existing tests split into the five dedicated acceptance files
- `AGENTS.md`
- `docs/DAILYFLOW_HANDOFF.md`
- generated `main.js` only if the normal build changes it

No runtime dependency or product feature is added.

## Verification

- Unit tests for contract collection, missing-contract failures, base checks, and overlap reports.
- A regression fixture proving that a merged preview fails when a feature test disappears even though remaining tests pass.
- Full project tests, syntax check, and build.
- Full `--release --copy` preview with clean included worktrees.
- Hash comparison between preview artifacts and the copied Obsidian files.
- Final verification on `feature/release-polish` before pushing the branch.

## Success Criteria

- Normal feature previews remain lightweight.
- Release preview stops before copy when a branch is dirty, behind the latest tag, or missing an acceptance test contract.
- Shared production files are reported with their contributing branches.
- The full integrated test set survives merging.
- The GitHub `feature/release-polish` branch contains the same tested product state that was approved in Obsidian.
