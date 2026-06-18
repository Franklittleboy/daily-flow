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
