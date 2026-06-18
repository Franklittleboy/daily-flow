const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

test("mobile layout keeps responsive shell, focus, and calendar behavior", () => {
  assert.match(styles, /@media \(max-width:\s*900px\)/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.daily-flow-shell\s*{/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.daily-flow-focus-layout\s*{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.daily-flow-month-grid,[\s\S]*\.daily-flow-week\s*{[^}]*min-width:\s*760px/s);
});
