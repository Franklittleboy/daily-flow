const DEFAULT_SLASH_COMMANDS = [
  { label: "切换列表/待办事项", insertText: "- [ ] " },
  { label: "插入分割线", insertText: "\n---\n" },
  { label: "添加删除线", insertText: "~~文本~~" }
];

const DEFAULT_SETTINGS = {
  defaultFocusMinutes: 25,
  weekStartsOn: "monday",
  showCompletedTasks: false,
  taskListPaneWidth: 540,
  taskNavPaneWidth: 320,
  slashCommands: DEFAULT_SLASH_COMMANDS
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

const CHINESE_LUNAR_DAYS = [
  "",
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十"
];

function createLunarFormatter() {
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat !== "function") {
    return null;
  }
  try {
    return new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { month: "long", day: "numeric" });
  } catch {
    return null;
  }
}

function formatLunarDay(dateString, formatter = createLunarFormatter()) {
  const date = parseLocalDate(dateString);
  if (!date || !formatter || typeof formatter.formatToParts !== "function") {
    return "";
  }

  const parts = formatter.formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!Number.isInteger(day) || day < 1 || day >= CHINESE_LUNAR_DAYS.length) {
    return "";
  }
  return day === 1 ? month : CHINESE_LUNAR_DAYS[day];
}

function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function createEmptyData() {
  return {
    tasks: [],
    focusSessions: [],
    settings: cloneSettings(DEFAULT_SETTINGS)
  };
}

function normalizeSlashCommand(command) {
  if (!command || typeof command !== "object") {
    return null;
  }
  const label = typeof command.label === "string" ? command.label.trim() : "";
  const insertText = typeof command.insertText === "string" ? command.insertText : "";
  if (!label || !insertText) {
    return null;
  }
  return { label, insertText };
}

function normalizeSlashCommands(commands) {
  if (!Array.isArray(commands)) {
    return DEFAULT_SLASH_COMMANDS.map((command) => ({ ...command }));
  }
  const normalized = commands.map(normalizeSlashCommand).filter(Boolean);
  return normalized.length ? normalized : DEFAULT_SLASH_COMMANDS.map((command) => ({ ...command }));
}

function cloneSettings(settings) {
  return {
    ...settings,
    slashCommands: normalizeSlashCommands(settings?.slashCommands)
  };
}

function normalizeSettings(settings) {
  const next = cloneSettings(DEFAULT_SETTINGS);
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
  if (Number.isFinite(settings.taskListPaneWidth)) {
    next.taskListPaneWidth = Math.min(760, Math.max(360, Math.round(settings.taskListPaneWidth)));
  }
  if (Number.isFinite(settings.taskNavPaneWidth)) {
    next.taskNavPaneWidth = Math.min(420, Math.max(240, Math.round(settings.taskNavPaneWidth)));
  }
  if (Array.isArray(settings.slashCommands)) {
    next.slashCommands = normalizeSlashCommands(settings.slashCommands);
  }
  return next;
}

function normalizeSubtask(subtask) {
  if (!subtask || typeof subtask !== "object") {
    return null;
  }
  const title = typeof subtask.title === "string" ? subtask.title.trim() : "";
  if (!title) {
    return null;
  }
  return {
    id: typeof subtask.id === "string" && subtask.id ? subtask.id : createId("subtask"),
    title,
    completed: Boolean(subtask.completed)
  };
}

function normalizeAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") {
    return null;
  }
  const name = typeof attachment.name === "string" ? attachment.name.trim() : "";
  if (!name) {
    return null;
  }
  return {
    id: typeof attachment.id === "string" && attachment.id ? attachment.id : createId("attachment"),
    name,
    path: typeof attachment.path === "string" ? attachment.path : "",
    mime: typeof attachment.mime === "string" ? attachment.mime : "",
    dataUrl: typeof attachment.dataUrl === "string" ? attachment.dataUrl : ""
  };
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
    kind: task.kind === "note" ? "note" : "task",
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(normalizeSubtask).filter(Boolean) : [],
    attachments: Array.isArray(task.attachments) ? task.attachments.map(normalizeAttachment).filter(Boolean) : [],
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
    settings: cloneSettings(normalized.settings)
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
    kind: input.kind === "note" ? "note" : "task",
    subtasks: Array.isArray(input.subtasks) ? input.subtasks.map(normalizeSubtask).filter(Boolean) : [],
    attachments: Array.isArray(input.attachments) ? input.attachments.map(normalizeAttachment).filter(Boolean) : [],
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
    kind: Object.hasOwn(changes, "kind") ? (changes.kind === "note" ? "note" : "task") : next.tasks[index].kind,
    subtasks: Object.hasOwn(changes, "subtasks") && Array.isArray(changes.subtasks)
      ? changes.subtasks.map(normalizeSubtask).filter(Boolean)
      : next.tasks[index].subtasks,
    attachments: Object.hasOwn(changes, "attachments") && Array.isArray(changes.attachments)
      ? changes.attachments.map(normalizeAttachment).filter(Boolean)
      : next.tasks[index].attachments,
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
  formatLunarDay,
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
