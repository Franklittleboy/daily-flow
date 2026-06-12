const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("DailyFlow keeps navigation on the right and main content first", () => {
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+56px\s+minmax\(180px,\s*240px\)/);
  assert.match(styles, /\.daily-flow-main\s*{[^}]*grid-column:\s*1/s);
  assert.match(styles, /\.daily-flow-rail\s*{[^}]*grid-column:\s*2/s);
  assert.match(styles, /\.daily-flow-middle\s*{[^}]*grid-column:\s*3/s);
});

test("DailyFlow exposes direct add affordances beyond the header plus button", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");

  assert.match(source, /daily-flow-add-task-row/);
  assert.match(source, /daily-flow-day-add/);
  assert.match(source, /daily-flow-week-add/);
});

test("month view renders readable task buttons inside date cells", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /daily-flow-day-top/);
  assert.match(source, /createEl\("button", "daily-flow-calendar-task"/);
  assert.match(source, /this\.openTaskDetail\(task\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(styles, /\.daily-flow-calendar-task\s*{[^}]*min-height:\s*22px/s);
  assert.match(styles, /\.daily-flow-calendar-task\s*{[^}]*font-weight:\s*600/s);
});

test("calendar task detail popover supports completion and date picking", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /openTaskDetail\(task\)/);
  assert.match(source, /renderTaskDetail\(main\)/);
  assert.match(source, /daily-flow-detail-check/);
  assert.match(source, /core\.completeTask\(this\.plugin\.data,\s*task\.id,\s*checkbox\.checked\)/);
  assert.match(source, /daily-flow-detail-date-picker/);
  assert.match(source, /renderDetailDatePicker\(task\)/);
  assert.match(source, /core\.updateTask\(this\.plugin\.data,\s*task\.id,\s*\{\s*dueDate:/s);
  assert.match(styles, /\.daily-flow-detail-card\s*{[^}]*box-shadow:\s*0 18px 48px/s);
  assert.match(styles, /\.daily-flow-date-picker-grid\s*{[^}]*grid-template-columns:\s*repeat\(7,\s*1fr\)/s);
});

test("task list rows use a single readable line with right-side date", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /daily-flow-task-date/);
  assert.doesNotMatch(source, /daily-flow-task-meta/);
  assert.match(styles, /grid-template-columns:\s*24px\s+minmax\(220px,\s*1fr\)\s+minmax\(96px,\s*auto\)\s+36px/);
  assert.match(styles, /\.daily-flow-task-title\s*{[^}]*white-space:\s*normal/s);
  assert.match(styles, /\.daily-flow-task-date\s*{[^}]*justify-self:\s*end/s);
});

test("visual chrome stays light and TickTick-like", () => {
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(styles, /--daily-flow-line:\s*rgba\(142,\s*149,\s*166,\s*0\.16\)/);
  assert.match(styles, /\.daily-flow-root button\s*{[^}]*box-shadow:\s*none/s);
  assert.match(styles, /\.daily-flow-root button\s*{[^}]*appearance:\s*none/s);
  assert.match(styles, /\.daily-flow-rail\s*{[^}]*background:\s*var\(--background-primary\)/s);
  assert.match(styles, /\.daily-flow-middle\s*{[^}]*border-left:\s*1px solid var\(--daily-flow-line\)/s);
  assert.match(styles, /\.daily-flow-task-row\s*{[^}]*border-bottom:\s*1px solid var\(--daily-flow-line\)/s);
  assert.match(styles, /\.daily-flow-week-column\s*{[^}]*border:\s*0/s);
});
