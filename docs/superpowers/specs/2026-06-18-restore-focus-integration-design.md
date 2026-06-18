# Restore Focus Integration Design

## Goal

Restore the focus-page behavior lost during release integration while preserving the accepted task-detail and calendar implementations.

## Scope

Restore these behaviors from commit `17a89f5` onto the current `feature/release-polish` tree:

- Show a visible focus-task binding control labeled `专注任务`, with `自由专注` as the unbound option.
- Re-render the focus page after the selected task changes.
- Exclude paused time when saving a completed or ended focus session.

Restore the regression coverage that was removed during later merges:

- Focus task binding and active-time accounting assertions.
- Lunar date formatting unit coverage already supported by the restored calendar implementation.

## Implementation

Make surgical changes only in:

- `src/obsidian-plugin.js`
- `styles.css`
- `src/layout-and-add.test.js`
- `src/date-utils.test.js`
- generated `main.js`

The focus implementation will track `pausedAt` and accumulated `pausedSeconds`, calculate active seconds in one helper, and use that helper when persisting a focus session. The current task-detail and calendar code remains the integration baseline.

Do not modify `scripts/refresh-preview.mjs` or introduce cross-branch prevention logic in this phase.

## Verification

1. Add the missing tests and confirm they fail against the current release tree.
2. Restore the minimum focus implementation and styles needed to pass them.
3. Run all tests, the syntax check, and the build.
4. Commit the restoration to `feature/release-polish`.
5. Run `scripts/refresh-preview.mjs --release --copy` and verify the copied artifacts match the integrated preview.

## Success Criteria

- The three lost focus behaviors are present.
- The focus and lunar regression tests are present and passing.
- Existing task-detail and calendar tests continue to pass.
- The full release preview is copied to Obsidian without pushing, tagging, or creating a GitHub Release.
