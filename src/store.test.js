const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createEmptyData,
  normalizeData,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  createFocusSession,
  getTodayTasks,
  getNextDaysTasks,
  groupInboxTasks,
  updateSettings
} = require("./core");

test("normalizeData fills missing data with safe defaults", () => {
  const data = normalizeData({ settings: { defaultFocusMinutes: 45 } });

  assert.deepEqual(data.tasks, []);
  assert.deepEqual(data.focusSessions, []);
  assert.equal(data.settings.defaultFocusMinutes, 45);
  assert.equal(data.settings.weekStartsOn, "monday");
  assert.equal(data.settings.showCompletedTasks, false);
});

test("createTask adds a dated incomplete task", () => {
  const data = createEmptyData();
  const result = createTask(data, {
    title: "Plan review",
    dueDate: "2026-06-12",
    note: "Read the checklist",
    now: new Date(2026, 5, 12, 9, 30)
  });

  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].title, "Plan review");
  assert.equal(result.tasks[0].dueDate, "2026-06-12");
  assert.equal(result.tasks[0].completed, false);
  assert.equal(result.tasks[0].note, "Read the checklist");
});

test("tasks preserve subtasks, attachments, and note mode", () => {
  let data = createTask(createEmptyData(), {
    title: "Plan review",
    dueDate: "2026-06-12",
    note: "Read the checklist",
    subtasks: [{ title: "Confirm scope" }],
    attachments: [{ name: "brief.pdf", path: "/tmp/brief.pdf" }]
  });

  const taskId = data.tasks[0].id;
  assert.equal(data.tasks[0].subtasks.length, 1);
  assert.equal(data.tasks[0].subtasks[0].title, "Confirm scope");
  assert.equal(data.tasks[0].subtasks[0].completed, false);
  assert.equal(data.tasks[0].attachments[0].name, "brief.pdf");
  assert.equal(data.tasks[0].kind, "task");

  data = updateTask(data, taskId, {
    kind: "note",
    note: "记录你的想法",
    subtasks: [{ id: data.tasks[0].subtasks[0].id, title: "Confirm scope", completed: true }],
    attachments: [
      { name: "brief.pdf", path: "/tmp/brief.pdf" },
      { name: "report.png", path: "report.png", mime: "image/png", dataUrl: "data:image/png;base64,abc123" }
    ]
  });

  const updated = data.tasks[0];
  assert.equal(updated.kind, "note");
  assert.equal(updated.subtasks[0].completed, true);
  assert.equal(updated.attachments.length, 2);
  assert.equal(updated.attachments[1].mime, "image/png");
  assert.equal(updated.attachments[1].dataUrl, "data:image/png;base64,abc123");
});

test("createTask rejects an empty title", () => {
  assert.throws(() => createTask(createEmptyData(), { title: "   " }), /Task title is required/);
});

test("update, complete, and delete task mutate by id without touching unrelated tasks", () => {
  let data = createEmptyData();
  data = createTask(data, { title: "First", dueDate: "2026-06-12" });
  data = createTask(data, { title: "Second", dueDate: null });

  const firstId = data.tasks[0].id;
  const secondId = data.tasks[1].id;

  data = updateTask(data, firstId, { title: "Updated", dueDate: "2026-06-13", note: "New note" });
  assert.equal(data.tasks.find((task) => task.id === firstId).title, "Updated");
  assert.equal(data.tasks.find((task) => task.id === secondId).title, "Second");

  data = completeTask(data, firstId, true);
  assert.equal(data.tasks.find((task) => task.id === firstId).completed, true);

  data = deleteTask(data, firstId);
  assert.equal(data.tasks.some((task) => task.id === firstId), false);
  assert.equal(data.tasks.some((task) => task.id === secondId), true);
});

test("task selectors return today, next days, and inbox groups", () => {
  const now = new Date(2026, 5, 12, 9, 30);
  let data = createEmptyData();
  data = createTask(data, { title: "Overdue", dueDate: "2026-06-11" });
  data = createTask(data, { title: "Today", dueDate: "2026-06-12" });
  data = createTask(data, { title: "Future", dueDate: "2026-06-15" });
  data = createTask(data, { title: "No date", dueDate: null });
  data = createTask(data, { title: "Far future", dueDate: "2026-06-30" });
  data = completeTask(data, data.tasks[4].id, true);

  assert.deepEqual(getTodayTasks(data.tasks, now).map((task) => task.title), ["Today"]);
  assert.deepEqual(getNextDaysTasks(data.tasks, 7, now).map((task) => task.title), ["Today", "Future"]);

  const groups = groupInboxTasks(data.tasks, now);
  assert.deepEqual(groups.overdue.map((task) => task.title), ["Overdue"]);
  assert.deepEqual(groups.today.map((task) => task.title), ["Today"]);
  assert.deepEqual(groups.future.map((task) => task.title), ["Future"]);
  assert.deepEqual(groups.noDate.map((task) => task.title), ["No date"]);
});

test("createFocusSession stores linked and unlinked focus records", () => {
  let data = createEmptyData();
  data = createTask(data, { title: "Deep work", dueDate: "2026-06-12" });

  data = createFocusSession(data, {
    taskId: data.tasks[0].id,
    startedAt: "2026-06-12T09:00:00.000Z",
    endedAt: "2026-06-12T09:25:00.000Z",
    plannedMinutes: 25,
    actualMinutes: 25,
    completed: true
  });

  data = createFocusSession(data, {
    taskId: null,
    startedAt: "2026-06-12T10:00:00.000Z",
    endedAt: "2026-06-12T10:10:00.000Z",
    plannedMinutes: 25,
    actualMinutes: 10,
    completed: false
  });

  assert.equal(data.focusSessions.length, 2);
  assert.equal(data.focusSessions[0].taskId, data.tasks[0].id);
  assert.equal(data.focusSessions[1].taskId, null);
});

test("updateSettings merges supported settings", () => {
  const data = updateSettings(createEmptyData(), {
    defaultFocusMinutes: 45,
    weekStartsOn: "sunday",
    showCompletedTasks: true
  });

  assert.deepEqual(data.settings, {
    defaultFocusMinutes: 45,
    weekStartsOn: "sunday",
    showCompletedTasks: true
  });
});
