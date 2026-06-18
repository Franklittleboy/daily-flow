# Restore Focus Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the focus task-binding UI and pause-aware duration accounting without disturbing the accepted task-detail and calendar integration.

**Architecture:** Port the behavior of commit `17a89f5` onto the current `feature/release-polish` tree with surgical edits. Restore the deleted feature tests first, then implement only the code required by those tests and rebuild the generated bundle.

**Tech Stack:** Node.js test runner, CommonJS plugin source, Obsidian DOM APIs, CSS, custom build script.

---

### Task 1: Restore Missing Regression Tests

**Files:**
- Modify: `src/layout-and-add.test.js`
- Modify: `src/date-utils.test.js`

- [ ] **Step 1: Add the focus regression test**

Append this test to `src/layout-and-add.test.js`:

```js
test("focus view exposes task binding and saves only active focus time", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /daily-flow-focus-task-binding/);
  assert.match(source, /自由专注/);
  assert.match(source, /taskPicker\.addEventListener\("change"[\s\S]*this\.render\(\)/);
  assert.match(source, /pausedAt/);
  assert.match(source, /pausedSeconds/);
  assert.match(source, /activeFocusSeconds\(endedAt\)/);
  assert.match(styles, /\.daily-flow-focus-task-binding\s*{/);
  assert.doesNotMatch(styles, /\.daily-flow-focus-select\s*{[^}]*pointer-events:\s*none/s);
});
```

- [ ] **Step 2: Restore the lunar formatter unit test**

Import `formatLunarDay` from `./core` and add:

```js
test("formatLunarDay returns a compact Chinese lunar label", () => {
  const formatter = {
    formatToParts() {
      return [
        { type: "month", value: "正月" },
        { type: "day", value: "1" }
      ];
    }
  };

  assert.equal(formatLunarDay("2026-02-17", formatter), "正月");
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test src/date-utils.test.js src/layout-and-add.test.js
```

Expected: the lunar test passes because the calendar implementation is present; the focus regression test fails because the visible binding and pause accounting are missing.

### Task 2: Restore Focus Behavior

**Files:**
- Modify: `src/obsidian-plugin.js`
- Modify: `styles.css`

- [ ] **Step 1: Restore focus pause state**

Add `pausedAt: null` and `pausedSeconds: 0` to the focus state. Reset both values in `resetFocusTimer()`.

- [ ] **Step 2: Restore the visible task binding**

In `renderFocus()`, wrap the task selector in `daily-flow-focus-task-binding`, label it `专注任务`, use `自由专注` for the empty option, and call `this.render()` after a selection change. Remove the old hidden selector plus `daily-flow-focus-link` button path.

- [ ] **Step 3: Restore pause-aware active time**

Record `pausedAt` when pausing, accumulate elapsed paused seconds when resuming, and add:

```js
activeFocusSeconds(endedAt) {
  if (!this.focus.startedAt) {
    return 0;
  }
  if (this.focus.mode === "stopwatch") {
    return this.focus.elapsedSeconds;
  }
  const totalSeconds = Math.max(0, Math.round((endedAt.getTime() - this.focus.startedAt.getTime()) / 1000));
  const currentPause = this.focus.pausedAt
    ? Math.max(0, Math.round((endedAt.getTime() - this.focus.pausedAt.getTime()) / 1000))
    : 0;
  return Math.max(0, totalSeconds - this.focus.pausedSeconds - currentPause);
}
```

Use `this.activeFocusSeconds(endedAt)` in `endFocus()`.

- [ ] **Step 4: Restore task-binding styles**

Add the original `daily-flow-focus-task-binding` pill styles, make `daily-flow-focus-select` visible, and remove the obsolete `daily-flow-focus-link` styles.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run the Task 1 command again.

Expected: all focused tests pass with no failures.

### Task 3: Verify, Build, Commit, and Preview

**Files:**
- Modify: generated `main.js`

- [ ] **Step 1: Run complete verification**

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test src/*.test.js
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check src/obsidian-plugin.js
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/build.mjs
```

Expected: 36 tests pass, syntax check exits zero, and `main.js` is rebuilt.

- [ ] **Step 2: Review the diff**

Confirm only the design/plan, four source or test files, and generated `main.js` changed. Confirm `scripts/refresh-preview.mjs` is untouched.

- [ ] **Step 3: Commit the restoration**

```bash
git add src/obsidian-plugin.js styles.css src/layout-and-add.test.js src/date-utils.test.js main.js
git commit -m "Restore focus integration behavior"
```

- [ ] **Step 4: Run the full release preview and copy**

From the repository root:

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/refresh-preview.mjs --release --copy
```

Expected: all included worktrees are clean, 36 tests pass, syntax and build checks pass, and the three plugin artifacts are copied to Obsidian.
