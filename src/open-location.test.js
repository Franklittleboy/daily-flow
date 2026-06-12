const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("DailyFlow opens in the main workspace instead of the right sidebar", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");

  assert.match(source, /getLeaf\(true\)/);
  assert.doesNotMatch(source, /getRightLeaf/);
});
