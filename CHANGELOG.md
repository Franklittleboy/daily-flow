# Changelog

## 0.1.10 - 2026-06-13

Draft local focus page redesign.

- Removed the middle icon rail so navigation only appears in the right sidebar.
- Reworked the focus page toward TickTick's pomodoro layout with mode tabs, a large central timer, overview cards, and focus history.
- Added stopwatch mode while preserving the existing pomodoro countdown flow.

## 0.1.9 - 2026-06-12

Adjusted calendar task colors by completion state.

- Month and week task bars now show incomplete tasks in a deeper blue.
- Completed calendar tasks remain visible and use a lighter blue-gray color.
- Added a regression test so calendar task colors stay tied to task status.

## 0.1.8 - 2026-06-12

Added a TickTick-like calendar task detail popover.

- Month and week task clicks now open an in-calendar detail card instead of the generic edit modal.
- Added a completion checkbox in the detail card to switch tasks between todo and done.
- Added a clickable date chip with a lightweight date picker for changing the task date.
- Kept extra task options out of the first version so the interaction stays focused.

## 0.1.7 - 2026-06-12

Removed remaining Obsidian button chrome from the DailyFlow workspace.

- Reset default button shadows and native appearance inside DailyFlow.
- Kept task rows, right navigation, date pills, and add controls visually flat.

## 0.1.6 - 2026-06-12

Refined the visual style to be closer to TickTick.

- Replaced heavier Obsidian-style borders with lighter DailyFlow divider tokens.
- Flattened the right-side navigation and task list chrome for a cleaner TickTick-like surface.
- Softened calendar and week view grid lines while keeping date cells easy to scan.
- Unified blue task bars, selected states, hover states, and focus overview panels.

## 0.1.5 - 2026-06-12

Improved task list readability.

- Reworked Today, Next 7 Days, and Inbox task rows into a TickTick-like single-line layout.
- Moved due date/status to a right-aligned date pill.
- Stopped rendering note/date metadata as a forced second line so task titles have more room.
- Preserved notes as hover text for quick reference.

## 0.1.4 - 2026-06-12

Improved month view readability.

- Reworked month date cells into a clearer TickTick-like structure with a date header and full-width task bars.
- Made month-view task bars clickable for editing existing tasks.
- Kept direct date-cell task creation while preventing duplicate click handling.
- Increased task bar contrast, height, and font weight for better scanning.

## 0.1.3 - 2026-06-12

Improved the first-use layout and task creation affordances.

- Moved DailyFlow navigation back to the right side while keeping the main task/calendar content visible in the primary workspace.
- Added direct add-task affordances in task lists, month calendar cells, and week view columns.

## 0.1.2 - 2026-06-12

Fixed DailyFlow opening in Obsidian's right sidebar by default.

- The ribbon icon and command now open DailyFlow in the main workspace as a full tab.
- Added a regression test to keep the plugin from opening in the right sidebar again.

## 0.1.1 - 2026-06-12

Fixed the plugin bundle so Obsidian can load DailyFlow successfully.

- Removed a bundled variable shadowing issue that caused `Cannot access 'core' before initialization`.
- Added a smoke test that verifies the built `main.js` loads with an Obsidian API stub.
- Added both CommonJS and `default` exports for better compatibility with Obsidian's plugin loader.

## 0.1.0 - 2026-06-12

Initial DailyFlow MVP.

- Added Today, Next 7 Days, and Inbox task views.
- Added month and week calendar views.
- Added task creation, editing, completion, and deletion.
- Added focus timer with optional task binding.
- Added focus history and simple stats.
- Added settings for focus duration, week start day, completed task visibility, and JSON export.
- Added local Obsidian plugin release files: `manifest.json`, `main.js`, `styles.css`, and `versions.json`.
