# Multi-Session Integration Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve parallel DailyFlow feature sessions while making release previews fail when feature contracts disappear, branches are behind the latest release tag, or shared production changes need review.

**Architecture:** Add a small pure helper module for deterministic contract and overlap analysis, then call it from the existing release preview script. Give each feature branch one owned acceptance test file, keep ordinary previews lightweight, and fold the final verified preview tree into `feature/release-polish` before pushing that branch.

**Tech Stack:** Node.js ESM scripts, CommonJS Node test runner, Git worktrees, existing DailyFlow build scripts.

---

### Task 1: Guard Logic With Failing Tests

**Files:**
- Create: `scripts/preview-guard.mjs`
- Create: `src/preview-guard.test.js`

- [ ] **Step 1: Write tests for contract extraction and missing contracts**

Create `src/preview-guard.test.js` with dynamic imports from `../scripts/preview-guard.mjs` and assertions covering:

```js
test("extractTestNames reads named node tests", () => {
  assert.deepEqual(
    extractTestNames('test("focus contract", () => {});\ntest(\'calendar contract\', () => {});'),
    ["focus contract", "calendar contract"]
  );
});

test("findMissingContracts reports the owning branch", () => {
  const missing = findMissingContracts(
    new Map([["feature/focus-page", ["focus contract", "timer contract"]]]),
    new Set(["focus contract"])
  );
  assert.deepEqual(missing, [{ branch: "feature/focus-page", testName: "timer contract" }]);
});
```

- [ ] **Step 2: Write tests for base and overlap reports**

Add assertions covering:

```js
test("findUnsyncedBranches returns branches missing the release tag", () => {
  assert.deepEqual(
    findUnsyncedBranches(["focus", "calendar"], (branch) => branch === "focus"),
    ["calendar"]
  );
});

test("findOverlappingFiles reports only shared production files", () => {
  const overlaps = findOverlappingFiles(new Map([
    ["focus", ["src/obsidian-plugin.js", "src/focus-page.test.js"]],
    ["calendar", ["src/obsidian-plugin.js", "styles.css"]]
  ]));
  assert.deepEqual(overlaps, [{ file: "src/obsidian-plugin.js", branches: ["focus", "calendar"] }]);
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test src/preview-guard.test.js
```

Expected: FAIL because `scripts/preview-guard.mjs` and its exports do not exist.

- [ ] **Step 4: Implement the pure helper module**

Export these functions from `scripts/preview-guard.mjs`:

```js
export function extractTestNames(source) {
  const names = [];
  const pattern = /\btest\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)\s*,/g;
  let match = pattern.exec(source);
  while (match) {
    names.push(match[1] || match[2] || match[3]);
    match = pattern.exec(source);
  }
  return names;
}

export function findMissingContracts(contractsByBranch, mergedNames) {
  const missing = [];
  for (const [branch, names] of contractsByBranch) {
    for (const testName of names) {
      if (!mergedNames.has(testName)) missing.push({ branch, testName });
    }
  }
  return missing;
}

export function findUnsyncedBranches(branches, containsBase) {
  return branches.filter((branch) => !containsBase(branch));
}

export function findOverlappingFiles(filesByBranch) {
  const owners = new Map();
  for (const [branch, files] of filesByBranch) {
    for (const file of files) {
      const production = file === "styles.css" || file === "main.js" || (file.startsWith("src/") && !file.endsWith(".test.js"));
      if (!production) continue;
      owners.set(file, [...(owners.get(file) || []), branch]);
    }
  }
  return [...owners]
    .filter(([, branches]) => branches.length > 1)
    .map(([file, branches]) => ({ file, branches }))
    .sort((left, right) => left.file.localeCompare(right.file));
}
```

Production files are `styles.css`, `main.js`, and files under `src/` that do not end in `.test.js`.

- [ ] **Step 5: Verify GREEN**

Run the Task 1 test command again.

Expected: all preview guard unit tests pass.

### Task 2: Add Release Preview Enforcement

**Files:**
- Modify: `scripts/refresh-preview.mjs`
- Test: `src/preview-guard.test.js`

- [ ] **Step 1: Add failing format tests**

Extend `src/preview-guard.test.js` with:

```js
test("formatMissingContracts names branches and tests", () => {
  assert.match(
    formatMissingContracts([{ branch: "feature/focus-page", testName: "focus contract" }]),
    /feature\/focus-page[\s\S]*focus contract/
  );
});

test("formatOverlapReport names files and contributing branches", () => {
  assert.match(
    formatOverlapReport([{ file: "styles.css", branches: ["focus", "calendar"] }]),
    /styles\.css[\s\S]*focus[\s\S]*calendar/
  );
});
```

Run the test and confirm it fails because the formatting helpers are absent. Export both helpers from `scripts/preview-guard.mjs` with stable plain-text output.

- [ ] **Step 2: Define feature contract ownership**

Add this release-only map to `scripts/refresh-preview.mjs`:

```js
const featureContracts = new Map([
  ["feature/focus-page", "src/focus-page.test.js"],
  ["feature/calendar-views", "src/calendar-views.test.js"],
  ["feature/task-detail-popover", "src/task-detail-popover.test.js"],
  ["feature/mobile-layout", "src/mobile-layout.test.js"]
]);
```

- [ ] **Step 3: Add release preflight**

For release mode only:

1. Resolve the latest `v?N.N.N` tag.
2. Print release-polish and feature tip hashes.
3. Fail if the latest tag is not an ancestor of an included feature branch, with the exact `sync-feature-base.mjs --branch=<branch> --verify` command.
4. Read each owned contract file from its branch with `git show` and collect named tests.
5. Collect each branch's production files changed since the tag.

- [ ] **Step 4: Add post-merge contract verification**

After merging and before running tests, collect all named tests under preview `src/*.test.js`. Fail with branch and test names when `findMissingContracts` returns entries.

- [ ] **Step 5: Print overlap report**

Print shared production files and contributing branches. An empty overlap list prints `Shared production files: none` and does not fail.

- [ ] **Step 6: Verify script tests and existing preview modes**

Run:

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test src/preview-guard.test.js
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check scripts/refresh-preview.mjs
```

Expected: pass. Ordinary `--branch` planning remains unchanged.

### Task 3: Synchronize Feature Bases

**Files:**
- Modify through Git merges: the four normal feature branches

- [ ] **Step 1: Check all feature worktrees are clean**

Run `git status --short --branch` in focus, calendar, task-detail, and mobile worktrees. Stop if any has uncommitted changes.

- [ ] **Step 2: Preview synchronization**

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-feature-base.mjs --all --dry-run
```

Expected: each branch reports whether `0.5.0` is already included or would be merged.

- [ ] **Step 3: Synchronize and verify**

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-feature-base.mjs --all --verify
```

Expected: every branch contains `0.5.0`; its tests, syntax check, and build pass. Stop on conflicts rather than choosing a whole-file winner.

### Task 4: Add Feature-Owned Acceptance Tests

**Files:**
- Create in focus worktree: `src/focus-page.test.js`
- Create in calendar worktree: `src/calendar-views.test.js`
- Create in task-detail worktree: `src/task-detail-popover.test.js`
- Create in mobile worktree: `src/mobile-layout.test.js`

- [ ] **Step 1: Add focus contracts**

Create this focused contract and commit it on `feature/focus-page`:

```js
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

test("focus page keeps accepted layout, task binding, and active-time accounting", () => {
  assert.match(source, /番茄专注/);
  assert.match(source, /daily-flow-focus-task-binding/);
  assert.match(source, /自由专注/);
  assert.match(source, /activeFocusSeconds\(endedAt\)/);
  assert.match(source, /pausedSeconds/);
  assert.match(styles, /\.daily-flow-focus-layout\s*{/);
  assert.match(styles, /\.daily-flow-focus-task-binding\s*{/);
});
```

- [ ] **Step 2: Add calendar contracts**

Create this contract and commit it on `feature/calendar-views`:

```js
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

test("calendar views keep accepted month and week behavior", () => {
  assert.match(source, /core\.formatLunarDay\(cell\.date\)/);
  assert.match(source, /tasks\.slice\(0,\s*6\)/);
  assert.match(source, /daily-flow-week-all-day/);
  assert.match(source, /daily-flow-week-resizer/);
  assert.match(source, /for \(let hour = 0; hour < 24; hour \+= 1\)/);
  assert.match(source, /timeScroll\.scrollTop = 8 \* 64/);
  assert.match(styles, /\.daily-flow-calendar-task\.is-todo/);
  assert.match(styles, /\.daily-flow-week-time-scroll\s*{[^}]*overflow-y:\s*auto/s);
});
```

- [ ] **Step 3: Add task-detail contracts**

Create this contract and commit it on `feature/task-detail-popover`:

```js
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

test("task detail keeps accepted sidebar, markdown, attachment, and menu behavior", () => {
  assert.match(source, /daily-flow-task-resizer/);
  assert.match(source, /daily-flow-task-detail-panel/);
  assert.match(source, /daily-flow-detail-md-editor/);
  assert.match(source, /daily-flow-image-preview/);
  assert.match(source, /renderTaskContextMenu/);
  assert.match(source, /renderDatePicker/);
  assert.match(styles, /\.daily-flow-task-detail-panel\s*{/);
});
```

- [ ] **Step 4: Add mobile contract**

Create this contract and commit it on `feature/mobile-layout`:

```js
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

test("mobile layout keeps responsive shell, focus, and calendar behavior", () => {
  assert.match(styles, /@media \(max-width:\s*900px\)/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.daily-flow-shell\s*{/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.daily-flow-focus-layout\s*{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.daily-flow-week\s*{[^}]*overflow-x:\s*auto/s);
});
```

### Task 5: Add Release Integration Contract and Documentation

**Files:**
- Create: `src/release-integration.test.js`
- Modify: `AGENTS.md`
- Modify: `docs/DAILYFLOW_HANDOFF.md`

- [ ] **Step 1: Add release integration contract**

Create `src/release-integration.test.js`:

```js
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

test("release integration keeps all accepted feature areas", () => {
  assert.match(source, /daily-flow-focus-task-binding/);
  assert.match(source, /core\.formatLunarDay\(cell\.date\)/);
  assert.match(source, /daily-flow-week-all-day/);
  assert.match(source, /daily-flow-detail-md-editor/);
  assert.match(styles, /@media \(max-width:\s*900px\)/);
});
```

- [ ] **Step 2: Update session rules**

Document feature ownership, dedicated test files, four-field handoff, cross-area overlap reporting, post-release base sync, and release-polish-only integration decisions.

- [ ] **Step 3: Run focused documentation and integration checks**

Run the release integration test and `git diff --check`.

### Task 6: Full Verification and Integrated Preview

**Files:**
- Modify: generated `main.js` only if the build changes it

- [ ] **Step 1: Run complete release-polish verification**

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test src/*.test.js
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check src/obsidian-plugin.js
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check scripts/refresh-preview.mjs
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/build.mjs
```

- [ ] **Step 2: Commit release-polish guard changes**

Commit helper, script, tests, documentation, and generated bundle locally.

- [ ] **Step 3: Run full release preview and copy**

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/refresh-preview.mjs --release --copy
```

Expected: input hashes, contract verification, overlap report, all tests, syntax check, build, and copy succeed.

- [ ] **Step 4: Verify copied artifacts**

Compare SHA-256 hashes for `manifest.json`, `main.js`, and `styles.css` between `.worktrees/preview-local` and the Obsidian plugin directory.

### Task 7: Make GitHub Match the Verified Preview

**Files:**
- Git history only

- [ ] **Step 1: Incorporate the verified preview**

Fast-forward or merge `preview/local-obsidian` into `feature/release-polish` without changing the verified tree. Confirm the product artifact hashes remain identical.

- [ ] **Step 2: Verify the release-polish branch again**

Run all tests, syntax checks, and build on `feature/release-polish`. Confirm its product tree matches the approved preview.

- [ ] **Step 3: Push the branch**

```bash
git push origin feature/release-polish
```

Do not move tag `0.5.0`, create a new tag, or create a GitHub Release.
