const assert = require("node:assert/strict");
const test = require("node:test");

const {
  formatLocalDate,
  isToday,
  isWithinNextDays,
  startOfWeek,
  getWeekDays,
  getMonthGrid
} = require("./core");

test("formatLocalDate returns a stable YYYY-MM-DD local date", () => {
  assert.equal(formatLocalDate(new Date(2026, 5, 12, 9, 30)), "2026-06-12");
});

test("isToday compares date strings against the supplied clock date", () => {
  const now = new Date(2026, 5, 12, 9, 30);

  assert.equal(isToday("2026-06-12", now), true);
  assert.equal(isToday("2026-06-11", now), false);
  assert.equal(isToday(null, now), false);
});

test("isWithinNextDays includes today and the inclusive future window", () => {
  const now = new Date(2026, 5, 12, 9, 30);

  assert.equal(isWithinNextDays("2026-06-12", 7, now), true);
  assert.equal(isWithinNextDays("2026-06-19", 7, now), true);
  assert.equal(isWithinNextDays("2026-06-20", 7, now), false);
  assert.equal(isWithinNextDays("2026-06-11", 7, now), false);
  assert.equal(isWithinNextDays(null, 7, now), false);
});

test("startOfWeek respects monday and sunday week starts", () => {
  const friday = new Date(2026, 5, 12, 9, 30);

  assert.equal(formatLocalDate(startOfWeek(friday, "monday")), "2026-06-08");
  assert.equal(formatLocalDate(startOfWeek(friday, "sunday")), "2026-06-07");
});

test("getWeekDays returns seven consecutive local date strings", () => {
  const friday = new Date(2026, 5, 12, 9, 30);

  assert.deepEqual(getWeekDays(friday, "monday"), [
    "2026-06-08",
    "2026-06-09",
    "2026-06-10",
    "2026-06-11",
    "2026-06-12",
    "2026-06-13",
    "2026-06-14"
  ]);
});

test("getMonthGrid returns complete weeks around the visible month", () => {
  const grid = getMonthGrid(2026, 5, "monday");

  assert.equal(grid.length, 35);
  assert.equal(grid[0].date, "2026-06-01");
  assert.equal(grid[0].inMonth, true);
  assert.equal(grid[34].date, "2026-07-05");
  assert.equal(grid[34].inMonth, false);
});
