const DEFAULT_SETTINGS = {
  defaultFocusMinutes: 25,
  weekStartsOn: "monday",
  showCompletedTasks: false
};

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseLocalDate(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isToday(dateString, now = new Date()) {
  return dateString === formatLocalDate(now);
}

function daysBetween(start, end) {
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
}

function isWithinNextDays(dateString, days, now = new Date()) {
  const date = parseLocalDate(dateString);
  if (!date) {
    return false;
  }
  const diff = daysBetween(now, date);
  return diff >= 0 && diff <= days;
}

function startOfWeek(date, weekStartsOn = "monday") {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const offset = weekStartsOn === "sunday" ? day : (day + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function getWeekDays(date, weekStartsOn = "monday") {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => formatLocalDate(addDays(start, index)));
}

function getMonthGrid(year, monthIndex, weekStartsOn = "monday") {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  const start = startOfWeek(firstOfMonth, weekStartsOn);
  const end = addDays(startOfWeek(lastOfMonth, weekStartsOn), 6);
  const cells = [];

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    cells.push({
      date: formatLocalDate(cursor),
      inMonth: cursor.getMonth() === monthIndex
    });
  }

  return cells;
}

function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function createEmptyData() {
  return {
    tasks: [],
    focusSessions: [],
    settings: { ...DEFAULT_SETTINGS }
  };
}

function normalizeSettings(settings) {
  const next = { ...DEFAULT_SETTINGS };
  if (!settings || typeof settings !== "object") {
    return next;
  }
  if (Number.isFinite(settings.defaultFocusMinutes) && settings.defaultFocusMinutes > 0) {
    next.defaultFocusMinutes = Math.round(settings.defaultFocusMinutes);
  }
  if (settings.weekStartsOn === "sunday" || settings.weekStartsOn === "monday") {
    next.weekStartsOn = settings.weekStartsOn;
  }
  if (typeof settings.showCompletedTasks === "boolean") {
    next.showCompletedTasks = settings.showCompletedTasks;
  }
  return next;
}

function normalizeTask(task) {
  if (!task || typeof task !== "object" || typeof task.title !== "string") {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: typeof task.id === "string" && task.id ? task.id : createId("task"),
    title: task.title.trim(),
    dueDate: typeof task.dueDate === "string" ? task.dueDate : null,
    completed: Boolean(task.completed),
    note: typeof task.note === "string" ? task.note : "",
    createdAt: typeof task.createdAt === "string" ? task.createdAt : now,
    updatedAt: typeof task.updatedAt === "string" ? task.updatedAt : now
  };
}

function normalizeFocusSession(session) {
  if (!session || typeof session !== "object") {
    return null;
  }
  if (typeof session.startedAt !== "string" || typeof session.endedAt !== "string") {
    return null;
  }
  return {
    id: typeof session.id === "string" && session.id ? session.id : createId("focus"),
    taskId: typeof session.taskId === "string" ? session.taskId : null,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    plannedMinutes: Number.isFinite(session.plannedMinutes) ? Math.max(1, Math.round(session.plannedMinutes)) : 25,
    actualMinutes: Number.isFinite(session.actualMinutes) ? Math.max(0, Math.round(session.actualMinutes)) : 0,
    completed: Boolean(session.completed)
  };
}

function normalizeData(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    tasks: Array.isArray(source.tasks) ? source.tasks.map(normalizeTask).filter(Boolean) : [],
    focusSessions: Array.isArray(source.focusSessions)
      ? source.focusSessions.map(normalizeFocusSession).filter(Boolean)
      : [],
    settings: normalizeSettings(source.settings)
  };
}

function cloneData(data) {
  const normalized = normalizeData(data);
  return {
    tasks: normalized.tasks.map((task) => ({ ...task })),
    focusSessions: normalized.focusSessions.map((session) => ({ ...session })),
    settings: { ...normalized.settings }
  };
}

function createTask(data, input) {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  if (!title) {
    throw new Error("Task title is required");
  }
  const now = input?.now instanceof Date ? input.now.toISOString() : new Date().toISOString();
  const next = cloneData(data);
  next.tasks.push({
    id: createId("task"),
    title,
    dueDate: typeof input.dueDate === "string" ? input.dueDate : null,
    completed: false,
    note: typeof input.note === "string" ? input.note : "",
    createdAt: now,
    updatedAt: now
  });
  return next;
}

function updateTask(data, taskId, changes) {
  const next = cloneData(data);
  const index = next.tasks.findIndex((task) => task.id === taskId);
  if (index === -1) {
    return next;
  }
  const title = Object.hasOwn(changes, "title") ? String(changes.title).trim() : next.tasks[index].title;
  if (!title) {
    throw new Error("Task title is required");
  }
  next.tasks[index] = {
    ...next.tasks[index],
    title,
    dueDate: Object.hasOwn(changes, "dueDate") ? changes.dueDate || null : next.tasks[index].dueDate,
    note: Object.hasOwn(changes, "note") ? String(changes.note || "") : next.tasks[index].note,
    updatedAt: new Date().toISOString()
  };
  return next;
}

function completeTask(data, taskId, completed = true) {
  const next = cloneData(data);
  const task = next.tasks.find((item) => item.id === taskId);
  if (task) {
    task.completed = Boolean(completed);
    task.updatedAt = new Date().toISOString();
  }
  return next;
}

function deleteTask(data, taskId) {
  const next = cloneData(data);
  next.tasks = next.tasks.filter((task) => task.id !== taskId);
  next.focusSessions = next.focusSessions.map((session) => (
    session.taskId === taskId ? { ...session, taskId: null } : session
  ));
  return next;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const dateA = a.dueDate || "9999-12-31";
    const dateB = b.dueDate || "9999-12-31";
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function incompleteTasks(tasks) {
  return tasks.filter((task) => !task.completed);
}

function getTodayTasks(tasks, now = new Date()) {
  return sortTasks(incompleteTasks(tasks).filter((task) => isToday(task.dueDate, now)));
}

function getNextDaysTasks(tasks, days, now = new Date()) {
  return sortTasks(incompleteTasks(tasks).filter((task) => isWithinNextDays(task.dueDate, days, now)));
}

function groupInboxTasks(tasks, now = new Date()) {
  const today = formatLocalDate(now);
  const groups = {
    overdue: [],
    today: [],
    future: [],
    noDate: []
  };

  for (const task of sortTasks(incompleteTasks(tasks))) {
    if (!task.dueDate) {
      groups.noDate.push(task);
    } else if (task.dueDate < today) {
      groups.overdue.push(task);
    } else if (task.dueDate === today) {
      groups.today.push(task);
    } else {
      groups.future.push(task);
    }
  }

  return groups;
}

function createFocusSession(data, input) {
  const next = cloneData(data);
  next.focusSessions.push({
    id: createId("focus"),
    taskId: typeof input.taskId === "string" ? input.taskId : null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    plannedMinutes: Math.max(1, Math.round(input.plannedMinutes)),
    actualMinutes: Math.max(0, Math.round(input.actualMinutes)),
    completed: Boolean(input.completed)
  });
  return next;
}

function updateSettings(data, changes) {
  const next = cloneData(data);
  next.settings = normalizeSettings({ ...next.settings, ...changes });
  return next;
}

module.exports = {
  DEFAULT_SETTINGS,
  formatLocalDate,
  parseLocalDate,
  addDays,
  isToday,
  isWithinNextDays,
  startOfWeek,
  getWeekDays,
  getMonthGrid,
  createEmptyData,
  normalizeData,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  getTodayTasks,
  getNextDaysTasks,
  groupInboxTasks,
  createFocusSession,
  updateSettings
};
