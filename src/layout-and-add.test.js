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
