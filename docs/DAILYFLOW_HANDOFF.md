# DailyFlow Handoff

## Latest Preview Rule Override

This section overrides any older preview wording later in this file.

- Normal feature branches: if Frank says `复制到 Obsidian 看效果` or `复制到 Obsidian 看整体效果`, default to the lightest preview: build in the current worktree and copy `manifest.json`, `main.js`, and `styles.css` to the Obsidian plugin directory. Do not merge `feature/release-polish`, do not run tests, and do not run syntax checks.
- Normal feature branches: only use `scripts/refresh-preview.mjs --branch=<current feature branch> --copy` if Frank explicitly says `集成预览`, `和 release-polish 合起来看`, or `完整验证`. Add `--full` only when full tests are requested.
- Release polish: if Frank says `复制到 Obsidian 看整体效果`, `发布前预览`, or asks to publish, use `scripts/refresh-preview.mjs --release --copy` and keep the full validation flow.
- If any included worktree has uncommitted changes during an integration or release preview, stop and ask Frank whether to commit, stash, or leave those changes out.
- Release previews also require every included feature branch to contain the latest release tag and preserve its owned acceptance tests. Missing contracts or an unsynchronized base stop the preview before copying.

## Current Baseline

- Project: DailyFlow Obsidian plugin.
- Current local release version: `0.5.0`.
- Current published baseline for parallel feature work: tag `0.5.0`.
- Do not push to GitHub or create a GitHub Release until Frank explicitly says the feature batch is finished.
- Local Obsidian plugin directory:
  `/Users/frank/Library/CloudStorage/OneDrive-个人/5 others/ob/.obsidian/plugins/daily-flow/`

## Current Draft State

The local `0.5.0` release candidate includes:

- Navigation uses the narrow right icon rail from the latest task-detail polish.
- Focus page was redesigned toward the TickTick pomodoro page:
  - title `番茄专注`
  - tabs `番茄计时` and `正计时`
  - large central circular timer
  - blue start button
  - right-side overview cards
  - focus history section
- Calendar task bars use status color:
  - incomplete tasks: deeper blue
  - completed tasks: lighter blue-gray
- Calendar views branch update:
  - incomplete month/week task bars now use an explicit TickTick-like blue todo state
  - month/week task rows are more compact for dense daily schedules
  - month cells show up to 6 tasks before the `+N` overflow marker
  - calendar top spacing and right sidebar width are reduced to leave more room for month/week grids
  - month day cells show a faint Chinese lunar date next to the solar day number when supported by the runtime
  - month weekday headers use a fixed thin grid row, and calendar task buttons override Obsidian's default button height for denser TickTick-like rows
  - calendar task text is left-aligned, and the month grid stretches to fill available vertical space to reduce bottom whitespace
  - week view now follows the TickTick-like structure: week-number/day header, all-day task area, draggable horizontal divider, and an 8 AM based time grid
  - week view keeps the all-day task area fixed while only the time grid scrolls; the time grid covers 0-24 and defaults to 8 AM
- Month/week task detail popover exists with completion toggle and date picker.
- Task detail popover branch update:
  - the latest `feature/task-detail-popover` task sidebar and detail editor are merged into `feature/release-polish`
  - new task and existing-task cards use compact DailyFlow floating cards instead of Obsidian's default modal
  - title, note, date, completion state, subtasks, local attachment records, and task actions are available from the card
  - start-focus binding and conversion to a note-style detail view are exposed from the task action flow
  - task-list pages can open an existing task in a right-side detail panel while calendar pages keep the floating detail card
  - the task list/detail split is draggable and persisted in settings
  - the task body uses a CodeMirror Markdown editor with a DailyFlow slash menu for todos, lists, dividers, and strikethrough
  - image attachments can render preview images and open in an in-plugin zoomable preview
- Combined local preview workflow exists for merging feature branches into `.worktrees/preview-local`, testing, building, and optionally copying to Obsidian.

## Parallel Worktrees

Use these isolated worktrees for new sessions:

| Area | Branch | Path |
| --- | --- | --- |
| Focus page | `feature/focus-page` | `.worktrees/focus-page` |
| Calendar views | `feature/calendar-views` | `.worktrees/calendar-views` |
| Task detail popover | `feature/task-detail-popover` | `.worktrees/task-detail-popover` |
| Mobile layout | `feature/mobile-layout` | `.worktrees/mobile-layout` |
| Release polish | `feature/release-polish` | `.worktrees/release-polish` |

Each feature session should work only in its assigned worktree.

## Multi-Session Integration Contracts

Each normal feature branch owns one acceptance test file:

| Branch | Acceptance test |
| --- | --- |
| `feature/focus-page` | `src/focus-page.test.js` |
| `feature/calendar-views` | `src/calendar-views.test.js` |
| `feature/task-detail-popover` | `src/task-detail-popover.test.js` |
| `feature/mobile-layout` | `src/mobile-layout.test.js` |

`feature/release-polish` owns `src/release-integration.test.js` for behavior that must survive the final combination.

Normal feature sessions do not merge sibling feature branches and do not resolve cross-feature overlap by choosing a whole file. When handing a feature to release-polish, record:

```text
Branch: feature/focus-page
Commit: <latest commit>
Acceptance test: src/focus-page.test.js
Shared production files: src/obsidian-plugin.js, styles.css
```

After publishing a version and before starting the next feature cycle, synchronize all normal feature branches:

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-feature-base.mjs --all --verify
```

The release preview prints exact branch commits, verifies the acceptance-test union, and reports production files changed by multiple feature branches. A missing contract, old feature base, dirty included worktree, failed test, syntax error, or failed build stops the run before Obsidian is overwritten.

If the tested integrated result must be pushed to GitHub, first incorporate `preview/local-obsidian` into `feature/release-polish`, verify that branch again, and push `feature/release-polish`. Do not push the disposable preview branch.

## Combined Local Preview

When Frank wants to copy the plugin into Obsidian and see the latest work from multiple feature sessions together, do not copy from a single feature worktree.

Use the generated preview worktree instead:

- Preview branch: `preview/local-obsidian`
- Preview path: `.worktrees/preview-local`
- Included feature branches by default:
  - `feature/focus-page`
  - `feature/calendar-views`
  - `feature/task-detail-popover`
  - `feature/mobile-layout`

Before refreshing the combined preview, each included feature worktree must have its changes committed locally. The preview script intentionally refuses to include dirty worktrees, because uncommitted edits are easy to lose, conflict, or accidentally mix into another feature.

Refresh, test, build, and copy the combined preview into Obsidian:

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/refresh-preview.mjs --copy
```

Refresh, test, and build without copying to Obsidian:

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/refresh-preview.mjs
```

To preview only selected branches:

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/refresh-preview.mjs --branches=feature/focus-page,feature/calendar-views --copy
```

The script resets only `.worktrees/preview-local`, then merges the selected feature branches into that generated preview worktree. Do not do feature development inside `.worktrees/preview-local`.

## Verification Commands

Run these from the active worktree:

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test src/*.test.js
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check src/obsidian-plugin.js
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/build.mjs
```

To copy a tested single-worktree build into Obsidian for manual review:

```bash
cp manifest.json main.js styles.css '/Users/frank/Library/CloudStorage/OneDrive-个人/5 others/ob/.obsidian/plugins/daily-flow/'
```

Prefer the combined local preview workflow above when Frank wants to see multiple feature branches together. Copying to the Obsidian directory may require elevated filesystem permission in Codex.

## New Session Prompt Template

Use this as the first message in a new Codex session:

```text
请先阅读 /Users/frank/Library/CloudStorage/OneDrive-个人/coding/codex/obsidian/docs/DAILYFLOW_HANDOFF.md。
本次只处理 [替换成功能名称]，工作目录使用 [替换成对应 worktree 路径]。
不要提交 GitHub，不要创建 Release，不要打 tag，除非我明确授权。
普通功能分支复制到 Obsidian 默认走最轻量预览；release-polish 复制、发布前预览或准备发布时，使用 scripts/refresh-preview.mjs --release --copy 并完整验证。
```

## Feature Scope Guide

- Focus page:
  Status 2026-06-13: ready for local review in `.worktrees/focus-page`. Focus task binding is now visible/selectable from the pomodoro page, and paused time is excluded from saved focus-session duration.
  Improve the TickTick-like pomodoro page, timer controls, focus history, overview cards, and focus task binding.
- Calendar views:
  Improve month/week layout, colors, spacing, direct creation, and task display density.
- Task detail popover:
  Status: implemented in `feature/task-detail-popover`.
  Improved the TickTick-like new task card and task detail views with title/note editing, date picker, completion state, subtasks, local attachment records, image attachment previews, a three-dot action menu, start-focus binding, and conversion to a note-style detail view. Existing tasks now open in a right-side detail panel on task-list pages and in a matching floating detail card on calendar pages, with overdue dates, description text, checklist rows, attachments, and footer tools aligned to the TickTick-style reference. Latest polish stores uploaded image attachments with previewable data, removes excess input boxes/dividers from the detail panel, keeps the list selector at the bottom, widens the task list so rows are complete by default, adds a persisted draggable task/detail split, removes remaining detail panel borders, and opens image attachments in an in-plugin zoomable preview. Remaining follow-up: design and implement the special option that creates a real `.md` note file from a task.
- Mobile layout:
  Make DailyFlow usable on Obsidian mobile, including navigation, task lists, calendar, and focus page.
- Release polish:
  Status 2026-06-17: published `0.5.0` from `.worktrees/release-polish` to GitHub after the full release preview passed and copied to Obsidian. The release includes the latest `feature/task-detail-popover` task sidebar and Markdown detail editor, preserves the release preview workflow, and updates `CHANGELOG.md`, `release-notes/0.5.0.md`, `manifest.json`, `package.json`, and `versions.json`.
  GitHub Release: `0.5.0`.

## Rules For Feature Sessions

- Keep changes scoped to the assigned feature.
- Do not edit unrelated behavior.
- Do not push to GitHub.
- Do not create tags.
- If the local Obsidian plugin directory is updated, mention that in the final response.
- If a feature branch is ready, leave it committed locally on its branch and report the commit hash.
