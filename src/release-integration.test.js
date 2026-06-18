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
  assert.match(source, /daily-flow-detail-md-body/);
  assert.match(styles, /@media \(max-width:\s*900px\)/);
});
