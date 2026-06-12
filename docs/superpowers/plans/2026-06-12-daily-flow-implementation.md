# DailyFlow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local-installable DailyFlow Obsidian plugin with task lists, month/week calendar views, and task-linked or free focus sessions.

**Architecture:** Use a small TypeScript Obsidian plugin with framework-free DOM rendering. Keep task/date/focus logic in testable modules, then have the Obsidian view call those modules and render the UI.

**Tech Stack:** TypeScript, Obsidian plugin API, esbuild, Vitest, Node.js, CSS.

---

## File Structure

- `manifest.json`: Obsidian plugin metadata for `daily-flow`.
- `versions.json`: Obsidian community release version mapping.
- `package.json`: build, test, and typecheck scripts.
- `tsconfig.json`: TypeScript compiler settings.
- `esbuild.config.mjs`: bundles `src/main.ts` into `main.js`.
- `src/types.ts`: task, focus session, settings, and saved-data types.
- `src/date-utils.ts`: date formatting, comparisons, week grid, and month grid.
- `src/store.ts`: plugin data loading, normalization, mutations, and selectors.
- `src/view.ts`: main DailyFlow Obsidian view and DOM rendering.
- `src/settings.ts`: settings tab and JSON export behavior.
- `src/main.ts`: plugin entrypoint.
- `src/date-utils.test.ts`: date behavior tests.
- `src/store.test.ts`: store mutation and selector tests.
- `styles.css`: DailyFlow UI styling.
- `README.md`: local install, beta release, and community submission notes.

## Task 1: Scaffold Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `manifest.json`
- Create: `versions.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Add package and build configuration**

Create scripts:

```json
{
  "scripts": {
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "dev": "node esbuild.config.mjs",
    "test": "vitest run",
    "typecheck": "tsc -noEmit -skipLibCheck"
  }
}
```

- [ ] **Step 2: Add Obsidian metadata**

Use plugin name `DailyFlow`, ID `daily-flow`, initial version `0.1.0`, minimum Obsidian app version `1.5.0`.

- [ ] **Step 3: Verify scaffold**

Run: `npm install`

Expected: dependencies install successfully.

## Task 2: TDD Core Date Utilities

**Files:**
- Create: `src/date-utils.test.ts`
- Create: `src/date-utils.ts`

- [ ] **Step 1: Write failing date tests**

Test `formatLocalDate`, `isToday`, `isWithinNextDays`, `startOfWeek`, `getWeekDays`, and `getMonthGrid`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/date-utils.test.ts`

Expected: tests fail because `src/date-utils.ts` does not exist yet.

- [ ] **Step 3: Implement date utilities**

Add pure date functions with stable `YYYY-MM-DD` local-date strings.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/date-utils.test.ts`

Expected: date utility tests pass.

## Task 3: TDD Store Logic

**Files:**
- Create: `src/types.ts`
- Create: `src/store.test.ts`
- Create: `src/store.ts`

- [ ] **Step 1: Write failing store tests**

Cover data normalization, add/update/complete/delete task, task selectors, focus session creation, and settings updates.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/store.test.ts`

Expected: tests fail because `src/store.ts` does not exist yet.

- [ ] **Step 3: Implement store logic**

Add framework-free data helpers and selectors.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/store.test.ts`

Expected: store tests pass.

## Task 4: Implement Obsidian Entrypoint and Settings

**Files:**
- Create: `src/main.ts`
- Create: `src/settings.ts`

- [ ] **Step 1: Add plugin class**

Register the DailyFlow view, ribbon icon, open command, and settings tab.

- [ ] **Step 2: Add settings tab**

Expose default focus minutes, week start day, completed visibility, and JSON export.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: TypeScript passes.

## Task 5: Implement DailyFlow View

**Files:**
- Create: `src/view.ts`
- Create: `styles.css`

- [ ] **Step 1: Render shell**

Render left rail, middle navigation, and main work area.

- [ ] **Step 2: Render task views**

Render Today, Next 7 Days, and Inbox task groups with add, edit, complete, and delete actions.

- [ ] **Step 3: Render calendar views**

Render month and week views with previous, today, next, and view switch controls.

- [ ] **Step 4: Render focus view**

Render timer, task selector, controls, stats, and recent focus history.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`

Expected: TypeScript passes.

## Task 6: Build and Release Readiness

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: `main.js` is generated without errors.

- [ ] **Step 3: Confirm release files**

Check `manifest.json`, `main.js`, `styles.css`, and `versions.json` exist.

- [ ] **Step 4: Commit implementation**

Commit all implementation files with a clear message.

## Self-Review

- Spec coverage: Tasks, calendar views, focus sessions, settings, JSON export, local data storage, and release files are covered.
- Scope: Repeating tasks, reminders, Markdown sync, tags, priority, subtasks, drag-and-drop, and sync remain intentionally excluded.
- Type consistency: Data types match the approved design: `Task`, `FocusSession`, `PluginSettings`, and saved plugin data.
