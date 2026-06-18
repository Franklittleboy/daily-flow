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
