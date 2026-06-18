const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

test("task detail keeps accepted sidebar, markdown, attachment, and menu behavior", () => {
  assert.match(source, /daily-flow-task-resizer/);
  assert.match(source, /daily-flow-detail-card/);
  assert.match(source, /daily-flow-detail-md-body/);
  assert.match(source, /daily-flow-image-preview-layer/);
  assert.match(source, /renderTaskContextMenu/);
  assert.match(source, /renderDetailDatePicker/);
  assert.match(styles, /\.daily-flow-detail-card\.is-panel\s*{/);
});
