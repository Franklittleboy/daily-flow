# DailyFlow Handoff

## Current Baseline

- Project: DailyFlow Obsidian plugin.
- Current local draft version: `0.1.10`.
- Baseline branch to use for parallel feature work: `draft/0.1.10-base`.
- Do not push to GitHub or create a GitHub Release until Frank explicitly says the feature batch is finished.
- Local Obsidian plugin directory:
  `/Users/frank/Library/CloudStorage/OneDrive-个人/5 others/ob/.obsidian/plugins/daily-flow/`

## Current Draft State

The local `0.1.10` draft includes:

- Removed the middle icon rail. Navigation is now only the right text sidebar.
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

## Verification Commands

Run these from the active worktree:

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test src/*.test.js
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check src/obsidian-plugin.js
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/build.mjs
```

To copy a tested local build into Obsidian for manual review:

```bash
cp manifest.json main.js styles.css '/Users/frank/Library/CloudStorage/OneDrive-个人/5 others/ob/.obsidian/plugins/daily-flow/'
```

Copying to the Obsidian directory may require elevated filesystem permission in Codex.

## New Session Prompt Template

Use this as the first message in a new Codex session:

```text
请先阅读 /Users/frank/Library/CloudStorage/OneDrive-个人/coding/codex/obsidian/docs/DAILYFLOW_HANDOFF.md。
本次只处理 [替换成功能名称]，工作目录使用 [替换成对应 worktree 路径]。
不要提交 GitHub，不要创建 Release。完成后运行测试、打包，并更新交接文件里的该功能状态。
```

## Feature Scope Guide

- Focus page:
  Status 2026-06-13: ready for local review in `.worktrees/focus-page`. Focus task binding is now visible/selectable from the pomodoro page, and paused time is excluded from saved focus-session duration.
  Improve the TickTick-like pomodoro page, timer controls, focus history, overview cards, and focus task binding.
- Calendar views:
  Improve month/week layout, colors, spacing, direct creation, and task display density.
- Task detail popover:
  Improve the calendar task detail card, date picker, completion state, title editing, and future task options.
- Mobile layout:
  Make DailyFlow usable on Obsidian mobile, including navigation, task lists, calendar, and focus page.
- Release polish:
  Status 2026-06-13: local release-prep pass completed in `.worktrees/release-polish`. Added `release-notes/0.1.10.md`; tests, syntax check, and build pass locally. No GitHub push, tag, or Release was created.
  Only after the feature batch is approved: merge branches, update changelog/release notes, build, tag, push, and create GitHub Release.

## Rules For Feature Sessions

- Keep changes scoped to the assigned feature.
- Do not edit unrelated behavior.
- Do not push to GitHub.
- Do not create tags.
- If the local Obsidian plugin directory is updated, mention that in the final response.
- If a feature branch is ready, leave it committed locally on its branch and report the commit hash.
