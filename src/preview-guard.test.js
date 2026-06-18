const assert = require("node:assert/strict");
const test = require("node:test");

let guard;

test.before(async () => {
  guard = await import("../scripts/preview-guard.mjs");
});

test("extractTestNames reads named node tests", () => {
  assert.deepEqual(
    guard.extractTestNames('test("focus contract", () => {});\ntest(\'calendar contract\', () => {});'),
    ["focus contract", "calendar contract"]
  );
});

test("findMissingContracts reports the owning branch", () => {
  const missing = guard.findMissingContracts(
    new Map([["feature/focus-page", ["focus contract", "timer contract"]]]),
    new Set(["focus contract"])
  );

  assert.deepEqual(missing, [
    { branch: "feature/focus-page", testName: "timer contract" }
  ]);
});

test("findUnsyncedBranches returns branches missing the release tag", () => {
  assert.deepEqual(
    guard.findUnsyncedBranches(["focus", "calendar"], (branch) => branch === "focus"),
    ["calendar"]
  );
});

test("findOverlappingFiles reports only shared production files", () => {
  const overlaps = guard.findOverlappingFiles(new Map([
    ["focus", ["src/obsidian-plugin.js", "src/focus-page.test.js"]],
    ["calendar", ["src/obsidian-plugin.js", "styles.css"]]
  ]));

  assert.deepEqual(overlaps, [
    { file: "src/obsidian-plugin.js", branches: ["focus", "calendar"] }
  ]);
});

test("formatMissingContracts names branches and tests", () => {
  assert.match(
    guard.formatMissingContracts([
      { branch: "feature/focus-page", testName: "focus contract" }
    ]),
    /feature\/focus-page[\s\S]*focus contract/
  );
});

test("formatOverlapReport names files and contributing branches", () => {
  assert.match(
    guard.formatOverlapReport([
      { file: "styles.css", branches: ["focus", "calendar"] }
    ]),
    /styles\.css[\s\S]*focus[\s\S]*calendar/
  );
});
