# TickTick-Style Task Plugin Design

Date: 2026-06-12
Status: Approved for implementation planning

## Goal

Build an Obsidian community plugin that provides a lightweight TickTick-like task and focus workflow inside Obsidian. The first release should feel visually close to the provided desktop TickTick screenshots while staying small enough to test, maintain, and publish safely.

## Key Assumptions

- Tasks are stored in the plugin's own data store, not as Markdown task lines.
- The first release is local-first and does not include account sync, collaboration, reminders, or mobile-specific behavior.
- The plugin should be implemented with TypeScript and Obsidian's native plugin APIs, using custom lightweight UI rather than a full frontend framework.
- The plugin will be prepared for GitHub release and later Obsidian community plugin submission.

## First Release Scope

Included:

- Main plugin view with a TickTick-like layout.
- Task navigation for Today, Next 7 Days, Inbox, Calendar, and Focus.
- Month view and week view.
- Create, edit, complete, and delete tasks.
- Task due dates and notes.
- Pomodoro/focus timer that can be bound to a task or run without a task.
- Focus session history and simple daily/total stats.
- Settings for default focus duration, week start day, completed task visibility, and JSON export.

Excluded from the first release:

- Markdown task synchronization.
- User accounts and cloud sync.
- Reminders and system notifications.
- Recurring tasks.
- Priority, tags, subtasks, and attachments.
- Drag-and-drop rescheduling.
- Trash recovery.
- Team or shared task features.
- Enforced break timers and audio alerts.

## UI Structure

The plugin opens as a dedicated Obsidian view.

Left rail:

- Compact icon navigation.
- Entries for Tasks, Calendar, and Focus.
- Visual style should be quiet and close to the screenshots: light background, blue active state, compact spacing.

Middle navigation/list area:

- In task mode, show Today, Next 7 Days, and Inbox.
- Inbox shows all incomplete tasks grouped by Overdue, Today, Future, and No Date.
- Counts should display beside each navigation item when useful.

Main work area:

- Calendar mode shows month and week views.
- Header includes add task, today, previous, next, and view switch controls.
- Month view uses a grid where dated tasks appear as compact blue bars.
- Week view shows the selected week with dated tasks grouped under each day.
- Clicking a day cell or the add button opens task creation.

Focus work area:

- Large circular timer display.
- Start, pause, resume, and end controls.
- Optional task selector before starting.
- Right side shows summary cards and recent focus records.

## Data Model

Data is stored through Obsidian's plugin data APIs, using `loadData()` and `saveData()`.

Task:

```ts
interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}
```

Focus session:

```ts
interface FocusSession {
  id: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string;
  plannedMinutes: number;
  actualMinutes: number;
  completed: boolean;
}
```

Settings:

```ts
interface PluginSettings {
  defaultFocusMinutes: number;
  weekStartsOn: "monday" | "sunday";
  showCompletedTasks: boolean;
}
```

## Filtering Rules

- Today: incomplete tasks whose `dueDate` is today.
- Next 7 Days: incomplete tasks whose `dueDate` is from today through the next 7 calendar days.
- Inbox: all incomplete tasks grouped by overdue, today, future, and no date.
- Month and week calendar views: tasks with a non-null `dueDate`.
- Completed tasks remain in storage and can be shown when the setting is enabled.

## Task Interactions

- Add task from the top add button or a calendar day cell.
- Calendar-created tasks default to the selected date.
- Task title is required.
- Due date and note are optional.
- Completing a task updates it immediately and removes it from incomplete-only views.
- Clicking a task opens a lightweight editor modal or side panel.
- Deleting a task permanently removes it in the first release.

## Focus Timer Behavior

- Default focus duration is configurable, with 25 minutes as the initial default.
- A focus session may be linked to an incomplete task.
- A focus session may also run without a task.
- Timer supports start, pause, resume, and end.
- Completed sessions are saved to focus history.
- Ended sessions record planned minutes, actual minutes, start time, end time, completion status, and optional task ID.
- The first release does not include notifications, sounds, or required break cycles.

## Architecture

Use a small TypeScript codebase organized around clear boundaries:

- Plugin entrypoint: registers the view, commands, ribbon icon, and settings tab.
- Data store module: owns loading, saving, validating, and mutating task/focus data.
- Date utilities: owns date formatting, today/next-seven-days logic, week/month grid generation.
- Task UI components: render navigation, task lists, task editor, and calendar task bars.
- Calendar view components: render month and week layouts.
- Focus view components: own timer state, controls, and focus history rendering.
- Settings tab: owns configurable defaults and JSON export.

The UI should use Obsidian-compatible DOM APIs and CSS classes, keeping external dependencies to a minimum.

## Error Handling

- If stored plugin data is missing, initialize empty task and focus arrays.
- If stored plugin data has an unexpected shape, keep the plugin loadable and show a clear notice that data could not be fully read.
- If a task title is empty, block saving and show a short validation message.
- If a focus session is ended before one minute, save actual duration using elapsed seconds rounded to the nearest practical minute for display.
- JSON export should fail visibly if serialization or clipboard/download behavior is unavailable.

## Verification Criteria

Local verification:

- Build succeeds.
- Lint or type check succeeds if configured.
- Plugin can be loaded manually in an Obsidian vault.
- Creating a task from Inbox appears in Inbox.
- Creating a task from a calendar date appears on that date in month and week views.
- Completing a task removes it from incomplete-only views.
- Editing title, due date, and note persists after Obsidian reload.
- A focus session can run with a task and creates a linked history record.
- A focus session can run without a task and creates an unlinked history record.
- Settings persist after reload.
- JSON export includes tasks, focus sessions, and settings.

Release verification:

- `manifest.json`, `main.js`, and `styles.css` are present in the release build.
- The GitHub release tag exactly matches the version in `manifest.json`.
- `versions.json` maps the plugin version to the minimum supported Obsidian version.
- The repository root includes `README.md` and `manifest.json`.

## Publishing Path

1. Scaffold the Obsidian plugin project from the official sample plugin structure.
2. Implement and verify the first release locally.
3. Create a GitHub repository for the plugin.
4. Publish a GitHub release with `manifest.json`, `main.js`, and `styles.css` as release assets.
5. Submit a pull request to `obsidianmd/obsidian-releases` after local and beta testing.

## Open Decisions Before Implementation

- Final plugin name and plugin ID.
- GitHub repository owner/name.
- Whether the first beta should be distributed manually or through BRAT before community submission.
