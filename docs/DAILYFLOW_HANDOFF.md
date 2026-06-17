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
  Improve the TickTick-like pomodoro page, timer controls, focus history, overview cards, and focus task binding.
- Calendar views:
  Improve month/week layout, colors, spacing, direct creation, and task display density.
- Task detail popover:
  Status: implemented in `feature/task-detail-popover`.
  Improved the TickTick-like new task card and task detail views with title/note editing, date picker, completion state, subtasks, local attachment records, image attachment previews, a three-dot action menu, start-focus binding, and conversion to a note-style detail view. Existing tasks now open in a right-side detail panel on task-list pages and in a matching floating detail card on calendar pages, with overdue dates, description text, checklist rows, attachments, and footer tools aligned to the TickTick-style reference. Latest polish stores uploaded image attachments with previewable data, removes excess input boxes/dividers from the detail panel, keeps the list selector at the bottom, and widens the task list so rows are complete by default. Follow-up polish adds persisted draggable task/detail and task-sidebar/list splits, switches the right navigation to the three TickTick-like task/calendar/focus icons, adds a task-only left sidebar for Today/Next 7 Days/Inbox, removes remaining detail panel borders, and opens image attachments in an in-plugin zoomable preview. The task rows now show a TickTick-like right-click menu with working date shortcuts for today, tomorrow, seven days later, custom date, and clear date; other menu entries are present as disabled placeholders until implemented. Latest context-menu polish keeps the menu inside the visible window. Latest detail polish removes the task/note mode switch and the split description/checklist blocks; the title is followed by a single full-width md-like free text area where users can type regular text, unordered lists, and `- [ ]` todo syntax. Existing checklist rows are shown as markdown todo lines only when the note body is empty, avoiding duplicated content. The header date/check/flag alignment and date picker placement were tightened toward the TickTick reference; the picker now opens next to the top date control and closes when clicking elsewhere in the detail card. Latest task-list polish vertically centers row checkboxes, titles, dates, and focus buttons on one line, and removes the bottom `+ Add task` row so task creation stays in the header/calendar affordances. Remaining follow-up: design and implement the special option that creates a real `.md` note file from a task.
- Mobile layout:
  Make DailyFlow usable on Obsidian mobile, including navigation, task lists, calendar, and focus page.
- Release polish:
  Only after the feature batch is approved: merge branches, update changelog/release notes, build, tag, push, and create GitHub Release.

## Rules For Feature Sessions

- Keep changes scoped to the assigned feature.
- Do not edit unrelated behavior.
- Do not push to GitHub.
- Do not create tags.
- If the local Obsidian plugin directory is updated, mention that in the final response.
- If a feature branch is ready, leave it committed locally on its branch and report the commit hash.
