/* DailyFlow Obsidian plugin */
const obsidian = require("obsidian");

const dailyFlowCore = (() => {
  const module = { exports: {} };
  const exports = module.exports;
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
      path: typeof attachment.path === "string" ? attachment.path : ""
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
      kind: Object.hasOwn(changes, "kind") && changes.kind === "note" ? "note" : next.tasks[index].kind,
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

  return module.exports;
})();

const pluginModule = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  const require = (id) => {
    if (id === "obsidian") return obsidian;
    if (id === "./core") return dailyFlowCore;
    throw new Error("Unsupported bundled require: " + id);
  };
  const { ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting } = require("obsidian");
  const core = require("./core");

  const VIEW_TYPE_DAILY_FLOW = "daily-flow-view";

  class DailyFlowPlugin extends Plugin {
    async onload() {
      this.data = core.normalizeData(await this.loadData());

      this.registerView(VIEW_TYPE_DAILY_FLOW, (leaf) => new DailyFlowView(leaf, this));

      this.addRibbonIcon("calendar-check", "Open DailyFlow", () => {
        this.activateView();
      });

      this.addCommand({
        id: "open-daily-flow",
        name: "Open DailyFlow",
        callback: () => this.activateView()
      });

      this.addSettingTab(new DailyFlowSettingTab(this.app, this));
    }

    onunload() {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE_DAILY_FLOW);
    }

    async activateView() {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_FLOW);
      const leaf = leaves[0] || this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_DAILY_FLOW, active: true });
      this.app.workspace.revealLeaf(leaf);
    }

    async setDailyData(data) {
      this.data = core.normalizeData(data);
      await this.saveData(this.data);
    }
  }

  class DailyFlowView extends ItemView {
    constructor(leaf, plugin) {
      super(leaf);
      this.plugin = plugin;
      this.section = "tasks";
      this.taskFilter = "inbox";
      this.calendarMode = "month";
      this.anchorDate = new Date();
      this.activeTaskDetailId = null;
      this.activeTaskComposer = null;
      this.detailDatePickerOpen = false;
      this.detailMenuOpen = false;
      this.detailSubtasksOpen = false;
      this.detailPickerAnchorDate = new Date();
      this.weekAllDayHeight = null;
      this.focus = {
        taskId: null,
        running: false,
        paused: false,
        mode: "pomodoro",
        startedAt: null,
        pausedAt: null,
        pausedSeconds: 0,
        elapsedSeconds: 0,
        remainingSeconds: plugin.data.settings.defaultFocusMinutes * 60,
        plannedMinutes: plugin.data.settings.defaultFocusMinutes,
        intervalId: null
      };
    }

    getViewType() {
      return VIEW_TYPE_DAILY_FLOW;
    }

    getDisplayText() {
      return "DailyFlow";
    }

    getIcon() {
      return "calendar-check";
    }

    async onOpen() {
      this.render();
    }

    async onClose() {
      this.stopFocusInterval();
    }

    render() {
      const root = this.containerEl.children[1];
      root.empty();
      root.addClass("daily-flow-root");

      const shell = createEl("div", "daily-flow-shell");
      root.appendChild(shell);

      shell.appendChild(this.renderMiddle());

      const main = createEl("main", "daily-flow-main");
      shell.appendChild(main);

      if (this.section === "calendar") {
        this.renderCalendar(main);
      } else if (this.section === "focus") {
        this.renderFocus(main);
      } else {
        this.renderTasks(main);
      }
      this.renderTaskComposer(main);
    }

    renderMiddle() {
      const middle = createEl("aside", "daily-flow-middle");
      const title = createEl("div", "daily-flow-middle-title", "DailyFlow");
      middle.appendChild(title);

      const todayCount = core.getTodayTasks(this.plugin.data.tasks).length;
      const weekCount = core.getNextDaysTasks(this.plugin.data.tasks, 7).length;
      const inboxCount = this.plugin.data.tasks.filter((task) => !task.completed).length;

      const navItems = [
        ["tasks", "today", "Today", todayCount],
        ["tasks", "next7", "Next 7 Days", weekCount],
        ["tasks", "inbox", "Inbox", inboxCount],
        ["calendar", "calendar", "Calendar", null],
        ["focus", "focus", "Focus", null]
      ];

      for (const [section, filter, label, count] of navItems) {
        const item = createEl("button", "daily-flow-nav-item");
        if (this.section === section && (section !== "tasks" || this.taskFilter === filter)) {
          item.addClass("is-active");
        }
        item.appendChild(createEl("span", "", label));
        if (count !== null) {
          item.appendChild(createEl("span", "daily-flow-count", String(count)));
        }
        item.addEventListener("click", () => {
          this.section = section;
          this.activeTaskDetailId = null;
          if (section === "tasks") {
            this.taskFilter = filter;
          }
          this.render();
        });
        middle.appendChild(item);
      }

      return middle;
    }

    renderTasks(main) {
      const label = this.taskFilter === "today"
        ? "Today"
        : this.taskFilter === "next7"
          ? "Next 7 Days"
          : "Inbox";
      main.appendChild(this.renderHeader(label, () => this.openTaskModal({ dueDate: this.defaultDueDateForFilter() })));

      if (this.taskFilter === "inbox") {
        const groups = core.groupInboxTasks(this.plugin.data.tasks);
        this.renderTaskGroup(main, "Overdue", groups.overdue);
        this.renderTaskGroup(main, "Today", groups.today);
        this.renderTaskGroup(main, "Future", groups.future);
        this.renderTaskGroup(main, "No Date", groups.noDate);
      } else {
        const tasks = this.taskFilter === "today"
          ? core.getTodayTasks(this.plugin.data.tasks)
          : core.getNextDaysTasks(this.plugin.data.tasks, 7);
        this.renderTaskGroup(main, label, tasks);
      }

      main.appendChild(this.renderAddTaskRow(this.defaultDueDateForFilter()));

      if (this.plugin.data.settings.showCompletedTasks) {
        this.renderTaskGroup(main, "Completed", this.plugin.data.tasks.filter((task) => task.completed));
      }
    }

    renderHeader(title, onAdd) {
      const header = createEl("header", "daily-flow-header");
      header.appendChild(createEl("h2", "", title));

      const actions = createEl("div", "daily-flow-header-actions");
      const add = createButton("+", "Add task", false);
      add.addEventListener("click", onAdd);
      actions.appendChild(add);

      if (this.section === "calendar") {
        const mode = createEl("select", "daily-flow-select");
        for (const value of ["month", "week"]) {
          const option = createEl("option", "", value === "month" ? "Month" : "Week");
          option.value = value;
          option.selected = this.calendarMode === value;
          mode.appendChild(option);
        }
        mode.addEventListener("change", () => {
          this.calendarMode = mode.value;
          this.render();
        });

        const previous = createButton("‹", "Previous", false);
        previous.addEventListener("click", () => this.moveCalendar(-1));
        const today = createEl("button", "daily-flow-text-button", "Today");
        today.addEventListener("click", () => {
          this.anchorDate = new Date();
          this.render();
        });
        const next = createButton("›", "Next", false);
        next.addEventListener("click", () => this.moveCalendar(1));

        actions.appendChild(mode);
        actions.appendChild(previous);
        actions.appendChild(today);
        actions.appendChild(next);
      }

      header.appendChild(actions);
      return header;
    }

    renderTaskGroup(container, title, tasks) {
      if (tasks.length === 0 && title !== "Inbox") {
        return;
      }

      const section = createEl("section", "daily-flow-task-group");
      section.appendChild(createEl("h3", "", `${title} ${tasks.length}`));

      if (tasks.length === 0) {
        section.appendChild(createEl("p", "daily-flow-empty", "No tasks yet."));
      }

      for (const task of tasks) {
        section.appendChild(this.renderTaskRow(task));
      }

      container.appendChild(section);
    }

    renderAddTaskRow(dueDate) {
      const row = createEl("button", "daily-flow-add-task-row", "+ Add task");
      row.addEventListener("click", () => this.openTaskModal({ dueDate }));
      return row;
    }

    renderTaskRow(task) {
      const row = createEl("div", "daily-flow-task-row");
      const checkbox = createEl("input", "daily-flow-check");
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.addEventListener("change", async () => {
        await this.plugin.setDailyData(core.completeTask(this.plugin.data, task.id, checkbox.checked));
        this.render();
      });

      const body = createEl("button", "daily-flow-task-body");
      body.appendChild(createEl("span", "daily-flow-task-title", task.title));
      if (task.note) {
        body.setAttribute("title", task.note);
      }
      body.addEventListener("click", () => this.openTaskModal(task));

      const date = createEl("button", "daily-flow-task-date", this.taskDateLabel(task));
      date.addEventListener("click", () => this.openTaskModal(task));

      const timer = createButton("◎", "Focus on task", false);
      timer.addEventListener("click", () => {
        this.section = "focus";
        this.focus.taskId = task.id;
        this.resetFocusTimer();
        this.render();
      });

      row.appendChild(checkbox);
      row.appendChild(body);
      row.appendChild(date);
      row.appendChild(timer);
      return row;
    }

    taskDateLabel(task) {
      if (!task.dueDate) {
        return "No date";
      }
      if (core.isToday(task.dueDate)) {
        return "Today";
      }
      return task.dueDate.slice(5);
    }

    renderCalendar(main) {
      const title = this.calendarMode === "month"
        ? `${this.anchorDate.getFullYear()}-${String(this.anchorDate.getMonth() + 1).padStart(2, "0")}`
        : `${this.anchorDate.getFullYear()}年${this.anchorDate.getMonth() + 1}月`;
      main.appendChild(this.renderHeader(title, () => this.openTaskModal({ dueDate: core.formatLocalDate(this.anchorDate) })));

      if (this.calendarMode === "month") {
        this.renderMonth(main);
      } else {
        this.renderWeek(main);
      }
      this.renderTaskDetail(main);
    }

    renderMonth(main) {
      const grid = createEl("div", "daily-flow-month-grid");
      for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
        grid.appendChild(createEl("div", "daily-flow-weekday", day));
      }

      const cells = core.getMonthGrid(
        this.anchorDate.getFullYear(),
        this.anchorDate.getMonth(),
        this.plugin.data.settings.weekStartsOn
      );

      for (const cell of cells) {
        const day = createEl("section", "daily-flow-day-cell");
        if (!cell.inMonth) {
          day.addClass("is-muted");
        }
        if (core.isToday(cell.date)) {
          day.addClass("is-today");
        }

        const dayTop = createEl("div", "daily-flow-day-top");
        const dateLine = createEl("div", "daily-flow-date-line");
        const dayNumber = createEl("button", "daily-flow-day-number", String(Number(cell.date.slice(8, 10))));
        dayNumber.addEventListener("click", (event) => {
          event.stopPropagation();
          this.openTaskModal({ dueDate: cell.date });
        });
        const lunar = core.formatLunarDay(cell.date);
        dateLine.appendChild(dayNumber);
        if (lunar) {
          dateLine.appendChild(createEl("span", "daily-flow-lunar", lunar));
        }
        const add = createEl("button", "daily-flow-day-add", "+ Add");
        add.addEventListener("click", (event) => {
          event.stopPropagation();
          this.openTaskModal({ dueDate: cell.date });
        });
        dayTop.appendChild(dateLine);
        dayTop.appendChild(add);
        day.appendChild(dayTop);

        const tasks = this.tasksForDate(cell.date);
        for (const task of tasks.slice(0, 6)) {
          const bar = createEl("button", "daily-flow-calendar-task", task.title);
          this.styleCalendarTask(bar, task);
          bar.addEventListener("click", (event) => {
            event.stopPropagation();
            this.openTaskDetail(task);
          });
          day.appendChild(bar);
        }
        if (tasks.length > 6) {
          day.appendChild(createEl("span", "daily-flow-more", `+${tasks.length - 6}`));
        }
        day.addEventListener("click", () => this.openTaskModal({ dueDate: cell.date }));
        grid.appendChild(day);
      }
      main.appendChild(grid);
    }

    renderWeek(main) {
      const week = createEl("div", "daily-flow-week");
      const days = core.getWeekDays(this.anchorDate, this.plugin.data.settings.weekStartsOn);
      if (this.weekAllDayHeight) {
        week.style.setProperty("--daily-flow-week-all-day-height", `${this.weekAllDayHeight}px`);
      }

      const head = createEl("div", "daily-flow-week-head");
      head.appendChild(createEl("div", "daily-flow-week-index", `${this.isoWeekNumber(core.parseLocalDate(days[0]) || this.anchorDate)}周`));
      for (const label of this.weekdayLabels()) {
        head.appendChild(createEl("div", "daily-flow-week-day-name", label));
      }
      week.appendChild(head);

      const allDay = createEl("div", "daily-flow-week-all-day");
      allDay.appendChild(createEl("div", "daily-flow-week-all-day-gutter"));
      for (const date of days) {
        const column = createEl("section", "daily-flow-week-column");
        if (core.isToday(date)) {
          column.addClass("is-today");
        }
        const title = createEl("button", "daily-flow-week-date");
        title.appendChild(createEl("span", "daily-flow-week-day-number", String(Number(date.slice(8, 10)))));
        const lunar = core.formatLunarDay(date);
        if (lunar) {
          title.appendChild(createEl("span", "daily-flow-lunar", lunar));
        }
        title.addEventListener("click", (event) => {
          event.stopPropagation();
          this.openTaskModal({ dueDate: date });
        });
        column.appendChild(title);

        const tasks = this.tasksForDate(date);
        for (const task of tasks) {
          const taskButton = createEl("button", "daily-flow-week-task", task.title);
          this.styleCalendarTask(taskButton, task);
          taskButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.openTaskDetail(task);
          });
          column.appendChild(taskButton);
        }
        column.addEventListener("click", () => this.openTaskModal({ dueDate: date }));
        allDay.appendChild(column);
      }
      week.appendChild(allDay);

      const resizer = createEl("div", "daily-flow-week-resizer");
      resizer.addEventListener("pointerdown", (event) => this.startWeekAllDayResize(event, week));
      week.appendChild(resizer);

      const timeScroll = createEl("div", "daily-flow-week-time-scroll");
      const timeGrid = createEl("div", "daily-flow-week-time-grid");
      for (let hour = 0; hour < 24; hour += 1) {
        timeGrid.appendChild(createEl("div", "daily-flow-week-time-label", this.hourLabel(hour)));
        for (const date of days) {
          const slot = createEl("button", "daily-flow-week-time-cell");
          slot.addEventListener("click", () => this.openTaskModal({ dueDate: date }));
          timeGrid.appendChild(slot);
        }
      }
      timeScroll.appendChild(timeGrid);
      week.appendChild(timeScroll);

      main.appendChild(week);
      requestAnimationFrame(() => {
        timeScroll.scrollTop = 8 * 64;
      });
    }

    weekdayLabels() {
      const labels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
      return this.plugin.data.settings.weekStartsOn === "sunday"
        ? ["周日", ...labels.slice(0, 6)]
        : labels;
    }

    hourLabel(hour) {
      const suffix = hour < 12 ? "AM" : "PM";
      const display = hour === 12 ? 12 : hour % 12;
      return `${display} ${suffix}`;
    }

    isoWeekNumber(date) {
      const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const day = target.getUTCDay() || 7;
      target.setUTCDate(target.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
      return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
    }

    startWeekAllDayResize(event, week) {
      event.preventDefault();
      const allDay = week.querySelector(".daily-flow-week-all-day");
      if (!allDay) {
        return;
      }
      const startY = event.clientY;
      const startHeight = allDay.getBoundingClientRect().height;
      const doc = week.ownerDocument;
      const move = (moveEvent) => {
        const next = Math.max(180, Math.min(640, startHeight + moveEvent.clientY - startY));
        this.weekAllDayHeight = next;
        week.style.setProperty("--daily-flow-week-all-day-height", `${next}px`);
      };
      const up = () => {
        doc.removeEventListener("pointermove", move);
        doc.removeEventListener("pointerup", up);
      };
      doc.addEventListener("pointermove", move);
      doc.addEventListener("pointerup", up);
    }

    renderFocus(main) {
      main.appendChild(this.renderFocusHeader());

      const layout = createEl("div", "daily-flow-focus-layout");
      const timerPane = createEl("section", "daily-flow-focus-timer");
      const taskBinding = createEl("label", "daily-flow-focus-task-binding");
      taskBinding.appendChild(createEl("span", "", "专注任务"));
      const taskPicker = createEl("select", "daily-flow-select daily-flow-focus-select");
      const none = createEl("option", "", "自由专注");
      none.value = "";
      taskPicker.appendChild(none);
      for (const task of this.plugin.data.tasks.filter((item) => !item.completed)) {
        const option = createEl("option", "", task.title);
        option.value = task.id;
        option.selected = this.focus.taskId === task.id;
        taskPicker.appendChild(option);
      }
      taskPicker.addEventListener("change", () => {
        this.focus.taskId = taskPicker.value || null;
        this.render();
      });
      taskBinding.appendChild(taskPicker);

      const ring = createEl("div", "daily-flow-focus-ring");
      ring.appendChild(createEl("div", "daily-flow-focus-time", this.currentFocusDisplay()));

      const controls = createEl("div", "daily-flow-focus-controls");
      const primary = createEl("button", "daily-flow-focus-start", this.focus.running && !this.focus.paused ? "暂停" : this.focus.paused ? "继续" : "开始");
      primary.addEventListener("click", () => this.toggleFocus());
      controls.appendChild(primary);

      if (this.focus.running || this.focus.paused) {
        const end = createEl("button", "daily-flow-focus-end", "结束");
        end.addEventListener("click", () => this.endFocus(false));
        controls.appendChild(end);
      }

      timerPane.appendChild(taskBinding);
      timerPane.appendChild(ring);
      timerPane.appendChild(controls);

      const history = createEl("aside", "daily-flow-focus-overview");
      const todayKey = core.formatLocalDate(new Date());
      const todays = this.plugin.data.focusSessions.filter((session) => session.startedAt.startsWith(todayKey));
      const totalMinutes = this.plugin.data.focusSessions.reduce((sum, session) => sum + session.actualMinutes, 0);
      history.appendChild(this.renderStatCards(todays.length, todays.reduce((sum, session) => sum + session.actualMinutes, 0), this.plugin.data.focusSessions.length, totalMinutes));
      history.appendChild(this.renderFocusHistory());

      layout.appendChild(timerPane);
      layout.appendChild(history);
      main.appendChild(layout);
    }

    renderFocusHeader() {
      const header = createEl("header", "daily-flow-focus-header");
      header.appendChild(createEl("h2", "", "番茄专注"));

      const tabs = createEl("div", "daily-flow-focus-tabs");
      for (const [mode, label] of [["pomodoro", "番茄计时"], ["stopwatch", "正计时"]]) {
        const tab = createEl("button", "daily-flow-focus-tab", label);
        if (this.focus.mode === mode) {
          tab.addClass("is-active");
        }
        tab.addEventListener("click", () => {
          if (this.focus.mode !== mode) {
            this.focus.mode = mode;
            this.resetFocusTimer();
            this.render();
          }
        });
        tabs.appendChild(tab);
      }
      header.appendChild(tabs);

      const actions = createEl("div", "daily-flow-focus-header-actions");
      const add = createEl("button", "daily-flow-focus-tool", "+");
      add.addEventListener("click", () => this.openTaskModal({ dueDate: core.formatLocalDate(new Date()) }));
      actions.appendChild(add);
      actions.appendChild(createEl("button", "daily-flow-focus-tool", "◦"));
      actions.appendChild(createEl("button", "daily-flow-focus-tool", "…"));
      header.appendChild(actions);
      return header;
    }

    renderStatCards(todayCount, todayMinutes, totalCount, totalMinutes) {
      const grid = createEl("div", "daily-flow-stats");
      const cards = [
        ["今日番茄", String(todayCount)],
        ["今日专注时长", `${todayMinutes} m`],
        ["总番茄", String(totalCount)],
        ["总专注时长", `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} m`]
      ];
      for (const [label, value] of cards) {
        const card = createEl("div", "daily-flow-stat");
        card.appendChild(createEl("span", "", label));
        card.appendChild(createEl("strong", "", value));
        grid.appendChild(card);
      }
      return grid;
    }

    renderFocusHistory() {
      const section = createEl("section", "daily-flow-focus-history");
      const header = createEl("div", "daily-flow-focus-history-header");
      header.appendChild(createEl("h3", "", "专注记录"));
      const actions = createEl("div", "daily-flow-focus-history-actions");
      actions.appendChild(createEl("button", "daily-flow-focus-tool", "+"));
      actions.appendChild(createEl("button", "daily-flow-focus-tool", "…"));
      header.appendChild(actions);
      section.appendChild(header);

      const sessions = [...this.plugin.data.focusSessions].reverse().slice(0, 12);
      const grouped = new Map();
      for (const session of sessions) {
        const key = session.startedAt.slice(0, 10);
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key).push(session);
      }

      if (sessions.length === 0) {
        section.appendChild(createEl("p", "daily-flow-empty", "暂无专注记录"));
        return section;
      }

      for (const [date, items] of grouped.entries()) {
        section.appendChild(createEl("div", "daily-flow-focus-history-date", this.formatFocusDate(date)));
        for (const session of items) {
          section.appendChild(this.renderFocusRecord(session));
        }
      }
      return section;
    }

    renderFocusRecord(session) {
      const row = createEl("div", "daily-flow-focus-record");
      const task = this.plugin.data.tasks.find((item) => item.id === session.taskId);
      const marker = createEl("span", "daily-flow-focus-record-marker", "◕");
      const body = createEl("div", "daily-flow-focus-record-body");
      body.appendChild(createEl("span", "", this.focusTimeRange(session)));
      body.appendChild(createEl("strong", "", task ? task.title : "自由专注"));
      row.appendChild(marker);
      row.appendChild(body);
      row.appendChild(createEl("span", "daily-flow-focus-record-duration", `${session.actualMinutes}m`));
      return row;
    }

    async openTaskModal(task) {
      if (!task.id) {
        this.activeTaskComposer = {
          title: "",
          dueDate: task.dueDate || core.formatLocalDate(new Date()),
          note: "",
          subtasks: [],
          checklistOpen: false
        };
        this.activeTaskDetailId = null;
        this.detailDatePickerOpen = false;
        this.detailMenuOpen = false;
        this.render();
        return;
      }
      new TaskModal(this.app, task, async (result) => {
        if (task.id) {
          await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, result));
        } else {
          await this.plugin.setDailyData(core.createTask(this.plugin.data, result));
        }
        this.render();
      }, async () => {
        if (task.id) {
          await this.plugin.setDailyData(core.deleteTask(this.plugin.data, task.id));
          this.render();
        }
      }).open();
    }

    renderTaskComposer(main) {
      if (!this.activeTaskComposer) {
        return;
      }

      const draft = this.activeTaskComposer;
      const layer = createEl("div", "daily-flow-detail-layer daily-flow-composer-layer");
      layer.addEventListener("click", async (event) => {
        if (event.target === layer) {
          await this.saveTaskComposer(false);
        }
      });

      const card = createEl("section", "daily-flow-modal-card");
      card.addEventListener("click", (event) => event.stopPropagation());

      const header = createEl("div", "daily-flow-modal-header");
      const dateInput = createEl("input", "daily-flow-modal-date-input");
      dateInput.type = "date";
      dateInput.value = draft.dueDate || core.formatLocalDate(new Date());
      const dateButton = createEl("button", "daily-flow-modal-date", `▦ ${formatChineseDate(dateInput.value)}`);
      dateButton.type = "button";
      dateButton.addEventListener("click", () => {
        if (typeof dateInput.showPicker === "function") {
          dateInput.showPicker();
        } else {
          dateInput.focus();
        }
      });
      dateInput.addEventListener("change", () => {
        draft.dueDate = dateInput.value || null;
        dateButton.textContent = `▦ ${formatChineseDate(draft.dueDate)}`;
      });
      header.appendChild(dateButton);
      header.appendChild(dateInput);
      header.appendChild(createEl("span", "daily-flow-modal-flag", "⚐"));
      card.appendChild(header);

      const body = createEl("div", "daily-flow-modal-body");
      const titleRow = createEl("div", "daily-flow-modal-title-row");
      const title = createEl("input", "daily-flow-modal-title");
      title.type = "text";
      title.placeholder = "准备做什么？";
      title.value = draft.title;
      title.addEventListener("input", () => {
        draft.title = title.value;
      });
      title.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          await this.saveTaskComposer(true);
        } else if (event.key === "Escape") {
          this.activeTaskComposer = null;
          this.render();
        }
      });

      const checklistToggle = createEl("button", "daily-flow-modal-checklist-toggle", "☷");
      checklistToggle.type = "button";
      checklistToggle.addEventListener("click", () => {
        draft.checklistOpen = !draft.checklistOpen;
        this.render();
      });
      titleRow.appendChild(title);
      titleRow.appendChild(checklistToggle);
      body.appendChild(titleRow);

      if (draft.checklistOpen) {
        const note = createEl("textarea", "daily-flow-modal-note");
        note.placeholder = "描述";
        note.value = draft.note;
        note.addEventListener("input", () => {
          draft.note = note.value;
        });
        body.appendChild(note);

        const checklist = createEl("textarea", "daily-flow-modal-subtasks");
        checklist.placeholder = "换行即可添加检查事项";
        checklist.value = draft.subtasks.map((subtask) => subtask.title).join("\n");
        checklist.addEventListener("input", () => {
          draft.subtasks = checklist.value.split("\n").map((line) => ({ title: line.trim(), completed: false }));
        });
        body.appendChild(checklist);
      }
      card.appendChild(body);

      const footer = createEl("div", "daily-flow-modal-actions");
      footer.appendChild(createEl("span", "daily-flow-modal-list", "▣ 收集箱"));
      card.appendChild(footer);
      layer.appendChild(card);
      main.appendChild(layer);
      title.focus();
    }

    async saveTaskComposer(requireTitle) {
      const draft = this.activeTaskComposer;
      if (!draft) {
        return;
      }
      const title = draft.title.trim();
      if (!title) {
        if (requireTitle) {
          new Notice("请输入待办事项标题。");
        } else {
          this.activeTaskComposer = null;
          this.render();
        }
        return;
      }
      await this.plugin.setDailyData(core.createTask(this.plugin.data, {
        title,
        dueDate: draft.dueDate || null,
        note: draft.note,
        subtasks: draft.subtasks
      }));
      this.activeTaskComposer = null;
      this.render();
    }

    openTaskDetail(task) {
      if (!task?.id) {
        return;
      }
      this.activeTaskDetailId = task.id;
      this.detailDatePickerOpen = false;
      this.detailMenuOpen = false;
      this.detailSubtasksOpen = false;
      this.detailPickerAnchorDate = core.parseLocalDate(task.dueDate) || new Date();
      this.render();
    }

    renderTaskDetail(main) {
      if (!this.activeTaskDetailId) {
        return;
      }
      const task = this.plugin.data.tasks.find((item) => item.id === this.activeTaskDetailId);
      if (!task) {
        this.activeTaskDetailId = null;
        this.detailDatePickerOpen = false;
        return;
      }

      const layer = createEl("div", "daily-flow-detail-layer");
      layer.addEventListener("click", (event) => {
        if (event.target === layer) {
          this.activeTaskDetailId = null;
          this.detailDatePickerOpen = false;
          this.detailMenuOpen = false;
          this.render();
        }
      });

      const card = createEl("section", "daily-flow-detail-card");
      card.addEventListener("click", (event) => event.stopPropagation());

      const header = createEl("div", "daily-flow-detail-header");
      if (task.kind === "note") {
        header.appendChild(createEl("span", "daily-flow-detail-note-dot", "i"));
      } else {
        const checkbox = createEl("input", "daily-flow-detail-check");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.addEventListener("change", async () => {
          await this.plugin.setDailyData(core.completeTask(this.plugin.data, task.id, checkbox.checked));
          this.render();
        });
        header.appendChild(checkbox);
      }
      header.appendChild(createEl("span", "daily-flow-detail-separator", ""));

      const date = createEl("button", "daily-flow-detail-date", this.taskDetailDateLabel(task));
      date.addEventListener("click", () => {
        this.detailDatePickerOpen = !this.detailDatePickerOpen;
        this.detailMenuOpen = false;
        this.detailPickerAnchorDate = core.parseLocalDate(task.dueDate) || this.detailPickerAnchorDate || new Date();
        this.render();
      });
      header.appendChild(date);
      header.appendChild(createEl("span", "daily-flow-detail-flag", "⚐"));
      card.appendChild(header);

      const title = createEl("input", "daily-flow-detail-title");
      title.type = "text";
      title.value = task.title;
      title.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          title.blur();
        } else if (event.key === "Escape") {
          title.value = task.title;
          title.blur();
        }
      });
      title.addEventListener("blur", async () => {
        const nextTitle = title.value.trim();
        if (nextTitle && nextTitle !== task.title) {
          try {
            await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, { title: nextTitle }));
            this.render();
          } catch (error) {
            new Notice(error.message || "Could not save task.");
          }
        }
      });
      card.appendChild(title);

      if (task.kind === "note") {
        const note = createEl("textarea", "daily-flow-note-body");
        note.placeholder = "记录你的想法，或 使用模板";
        note.value = task.note || "";
        note.addEventListener("blur", async () => {
          if (note.value !== task.note) {
            await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, { note: note.value }));
            this.render();
          }
        });
        card.appendChild(note);
      } else {
        const note = createEl("textarea", "daily-flow-detail-note");
        note.placeholder = "描述";
        note.value = task.note || "";
        note.addEventListener("blur", async () => {
          if (note.value !== task.note) {
            await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, { note: note.value }));
            this.render();
          }
        });
        card.appendChild(note);
        if (this.detailSubtasksOpen || task.subtasks.length > 0) {
          card.appendChild(this.renderSubtasks(task));
        }
      }

      if (task.attachments.length > 0) {
        const attachments = createEl("div", "daily-flow-attachments");
        for (const attachment of task.attachments) {
          attachments.appendChild(createEl("span", "daily-flow-attachment", `⌘ ${attachment.name}`));
        }
        card.appendChild(attachments);
      }

      if (this.detailDatePickerOpen) {
        card.appendChild(this.renderDetailDatePicker(task));
      }

      const footer = createEl("div", "daily-flow-detail-footer");
      footer.appendChild(createEl("span", "daily-flow-detail-list", "▣ 收集箱"));
      const tools = createEl("div", "daily-flow-detail-tools");
      tools.appendChild(createEl("button", "daily-flow-detail-tool", "A"));
      tools.appendChild(createEl("button", "daily-flow-detail-tool", "▣"));
      const more = createEl("button", "daily-flow-detail-tool daily-flow-detail-more", "…");
      more.addEventListener("click", () => {
        this.detailMenuOpen = !this.detailMenuOpen;
        this.detailDatePickerOpen = false;
        this.render();
      });
      tools.appendChild(more);
      footer.appendChild(tools);
      card.appendChild(footer);

      if (this.detailMenuOpen) {
        card.appendChild(this.renderDetailMenu(task));
      }

      layer.appendChild(card);
      main.appendChild(layer);
    }

    renderSubtasks(task) {
      const section = createEl("div", "daily-flow-subtasks");
      for (const subtask of task.subtasks) {
        const row = createEl("label", "daily-flow-subtask-row");
        const check = createEl("input", "");
        check.type = "checkbox";
        check.checked = subtask.completed;
        check.addEventListener("change", async () => {
          const subtasks = task.subtasks.map((item) => item.id === subtask.id ? { ...item, completed: check.checked } : item);
          await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, { subtasks }));
          this.render();
        });
        const input = createEl("input", "daily-flow-subtask-title");
        input.type = "text";
        input.value = subtask.title;
        input.addEventListener("blur", async () => {
          const nextTitle = input.value.trim();
          const subtasks = task.subtasks
            .map((item) => item.id === subtask.id ? { ...item, title: nextTitle || item.title } : item);
          await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, { subtasks }));
          this.render();
        });
        row.appendChild(check);
        row.appendChild(input);
        section.appendChild(row);
      }

      const add = createEl("input", "daily-flow-subtask-add");
      add.type = "text";
      add.placeholder = "换行即可添加检查事项";
      add.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          const title = add.value.trim();
          if (title) {
            await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, {
              subtasks: [...task.subtasks, { title, completed: false }]
            }));
            this.render();
          }
        }
      });
      section.appendChild(add);
      return section;
    }

    renderDetailMenu(task) {
      const menu = createEl("div", "daily-flow-detail-menu");
      const items = [
        ["└", "添加子任务", () => {
          this.detailSubtasksOpen = true;
          this.detailMenuOpen = false;
          this.render();
        }],
        ["☒", "放弃", null],
        ["◇", "标签", null],
        ["⌕", "上传附件", () => this.uploadAttachment(task)],
        ["◎", "开始专注", () => this.startFocusForTask(task.id), true],
        ["▦", "任务动态", null],
        ["T", "保存为模板", null],
        ["▢", "创建副本", null],
        ["↪", "复制链接", null],
        ["▱", "打开便签", null],
        ["▣", "转换为笔记", () => this.convertTaskToNote(task)],
        ["▤", "打印", null],
        ["⌫", "删除", async () => {
          await this.plugin.setDailyData(core.deleteTask(this.plugin.data, task.id));
          this.activeTaskDetailId = null;
          this.detailMenuOpen = false;
          this.render();
        }]
      ];

      for (const [icon, label, action, hasArrow] of items) {
        const item = createEl("button", "daily-flow-detail-menu-item");
        if (!action) {
          item.addClass("is-placeholder");
        }
        item.appendChild(createEl("span", "daily-flow-detail-menu-icon", icon));
        item.appendChild(createEl("span", "", label));
        if (hasArrow) {
          item.appendChild(createEl("span", "daily-flow-detail-menu-arrow", "›"));
        }
        if (action) {
          item.addEventListener("click", action);
        }
        menu.appendChild(item);
      }
      return menu;
    }

    async uploadAttachment(task) {
      const input = createEl("input");
      input.type = "file";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) {
          return;
        }
        await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, {
          attachments: [...task.attachments, { name: file.name, path: file.path || file.name }]
        }));
        this.detailMenuOpen = false;
        this.render();
      });
      input.click();
    }

    startFocusForTask(taskId) {
      this.activeTaskDetailId = null;
      this.detailMenuOpen = false;
      this.section = "focus";
      this.focus.taskId = taskId;
      this.resetFocusTimer();
      this.focus.running = true;
      this.focus.startedAt = new Date();
      this.startFocusInterval();
      this.render();
    }

    async convertTaskToNote(task) {
      await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, {
        kind: "note",
        note: task.note || ""
      }));
      this.detailMenuOpen = false;
      this.render();
    }

    renderDetailDatePicker(task) {
      const picker = createEl("div", "daily-flow-detail-date-picker");
      const tabs = createEl("div", "daily-flow-date-picker-tabs");
      tabs.appendChild(createEl("span", "is-active", "日期"));
      picker.appendChild(tabs);

      const monthHeader = createEl("div", "daily-flow-date-picker-header");
      monthHeader.appendChild(createEl("strong", "", `${this.detailPickerAnchorDate.getFullYear()}-${String(this.detailPickerAnchorDate.getMonth() + 1).padStart(2, "0")}`));
      const controls = createEl("div", "daily-flow-date-picker-controls");
      const previous = createEl("button", "daily-flow-date-picker-nav", "‹");
      previous.addEventListener("click", () => {
        const next = new Date(this.detailPickerAnchorDate);
        next.setMonth(next.getMonth() - 1);
        this.detailPickerAnchorDate = next;
        this.render();
      });
      const next = createEl("button", "daily-flow-date-picker-nav", "›");
      next.addEventListener("click", () => {
        const nextMonth = new Date(this.detailPickerAnchorDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        this.detailPickerAnchorDate = nextMonth;
        this.render();
      });
      controls.appendChild(previous);
      controls.appendChild(next);
      monthHeader.appendChild(controls);
      picker.appendChild(monthHeader);

      const grid = createEl("div", "daily-flow-date-picker-grid");
      for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
        grid.appendChild(createEl("span", "daily-flow-date-picker-weekday", day));
      }
      const cells = core.getMonthGrid(
        this.detailPickerAnchorDate.getFullYear(),
        this.detailPickerAnchorDate.getMonth(),
        this.plugin.data.settings.weekStartsOn
      );
      for (const cell of cells) {
        const day = createEl("button", "daily-flow-date-picker-day");
        day.textContent = String(Number(cell.date.slice(8, 10)));
        if (!cell.inMonth) {
          day.addClass("is-muted");
        }
        if (task.dueDate === cell.date) {
          day.addClass("is-selected");
        }
        day.addEventListener("click", async () => {
          await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, { dueDate: cell.date }));
          this.detailDatePickerOpen = false;
          this.detailPickerAnchorDate = core.parseLocalDate(cell.date) || this.detailPickerAnchorDate;
          this.render();
        });
        grid.appendChild(day);
      }
      picker.appendChild(grid);

      const actions = createEl("div", "daily-flow-date-picker-actions");
      const clear = createEl("button", "daily-flow-date-picker-clear", "清除");
      clear.addEventListener("click", async () => {
        await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, { dueDate: null }));
        this.detailDatePickerOpen = false;
        this.render();
      });
      actions.appendChild(clear);
      picker.appendChild(actions);
      return picker;
    }

    taskDetailDateLabel(task) {
      if (!task.dueDate) {
        return "无日期";
      }
      return formatChineseDate(task.dueDate);
    }

    defaultDueDateForFilter() {
      if (this.taskFilter === "today" || this.taskFilter === "next7") {
        return core.formatLocalDate(new Date());
      }
      return null;
    }

    tasksForDate(date) {
      return this.plugin.data.tasks
        .filter((task) => task.dueDate === date)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    styleCalendarTask(button, task) {
      if (task.completed) {
        button.addClass("is-completed");
      } else {
        button.addClass("is-todo");
      }
    }

    moveCalendar(direction) {
      const next = new Date(this.anchorDate);
      if (this.calendarMode === "month") {
        next.setMonth(next.getMonth() + direction);
      } else {
        next.setDate(next.getDate() + direction * 7);
      }
      this.anchorDate = next;
      this.render();
    }

    resetFocusTimer() {
      this.stopFocusInterval();
      this.focus.running = false;
      this.focus.paused = false;
      this.focus.startedAt = null;
      this.focus.pausedAt = null;
      this.focus.pausedSeconds = 0;
      this.focus.elapsedSeconds = 0;
      this.focus.plannedMinutes = this.plugin.data.settings.defaultFocusMinutes;
      this.focus.remainingSeconds = this.focus.plannedMinutes * 60;
    }

    toggleFocus() {
      if (!this.focus.running && !this.focus.paused) {
        this.focus.running = true;
        this.focus.paused = false;
        this.focus.startedAt = new Date();
        this.focus.pausedAt = null;
        this.focus.pausedSeconds = 0;
        this.startFocusInterval();
      } else if (this.focus.running) {
        this.focus.running = false;
        this.focus.paused = true;
        this.focus.pausedAt = new Date();
        this.stopFocusInterval();
      } else if (this.focus.paused) {
        if (this.focus.pausedAt) {
          this.focus.pausedSeconds += Math.max(0, Math.round((Date.now() - this.focus.pausedAt.getTime()) / 1000));
        }
        this.focus.running = true;
        this.focus.paused = false;
        this.focus.pausedAt = null;
        this.startFocusInterval();
      }
      this.render();
    }

    startFocusInterval() {
      this.stopFocusInterval();
      this.focus.intervalId = window.setInterval(() => {
        if (!this.focus.running) {
          return;
        }
        if (this.focus.mode === "stopwatch") {
          this.focus.elapsedSeconds += 1;
          this.render();
          return;
        }
        this.focus.remainingSeconds = Math.max(0, this.focus.remainingSeconds - 1);
        if (this.focus.remainingSeconds === 0) {
          this.endFocus(true);
        } else {
          this.render();
        }
      }, 1000);
    }

    stopFocusInterval() {
      if (this.focus.intervalId) {
        window.clearInterval(this.focus.intervalId);
        this.focus.intervalId = null;
      }
    }

    activeFocusSeconds(endedAt) {
      if (!this.focus.startedAt) {
        return 0;
      }
      if (this.focus.mode === "stopwatch") {
        return this.focus.elapsedSeconds;
      }
      const totalSeconds = Math.max(0, Math.round((endedAt.getTime() - this.focus.startedAt.getTime()) / 1000));
      const currentPause = this.focus.pausedAt
        ? Math.max(0, Math.round((endedAt.getTime() - this.focus.pausedAt.getTime()) / 1000))
        : 0;
      return Math.max(0, totalSeconds - this.focus.pausedSeconds - currentPause);
    }

    async endFocus(completed) {
      if (!this.focus.startedAt) {
        this.resetFocusTimer();
        this.render();
        return;
      }
      const endedAt = new Date();
      const elapsedSeconds = this.activeFocusSeconds(endedAt);
      const actualMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
      await this.plugin.setDailyData(core.createFocusSession(this.plugin.data, {
        taskId: this.focus.taskId,
        startedAt: this.focus.startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        plannedMinutes: this.focus.plannedMinutes,
        actualMinutes,
        completed
      }));
      this.resetFocusTimer();
      this.render();
    }

    formatSeconds(seconds) {
      const minutes = Math.floor(seconds / 60);
      const remainder = seconds % 60;
      return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }

    currentFocusDisplay() {
      return this.focus.mode === "stopwatch"
        ? this.formatSeconds(this.focus.elapsedSeconds)
        : this.formatSeconds(this.focus.remainingSeconds);
    }

    formatFocusDate(value) {
      const date = core.parseLocalDate(value);
      if (!date) {
        return value;
      }
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }

    focusTimeRange(session) {
      const started = new Date(session.startedAt);
      const ended = new Date(session.endedAt);
      if (Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime())) {
        return formatDateTime(session.startedAt);
      }
      const prefix = (date) => `${date.getHours() < 12 ? "上午" : "下午"} ${String(date.getHours() % 12 || 12)}:${String(date.getMinutes()).padStart(2, "0")}`;
      return `${prefix(started)} - ${prefix(ended)}`;
    }
  }

  class TaskModal extends Modal {
    constructor(app, task, onSave, onDelete) {
      super(app);
      this.task = task || {};
      this.onSave = onSave;
      this.onDelete = onDelete;
      this.checklistOpen = Array.isArray(this.task.subtasks) && this.task.subtasks.length > 0;
    }

    onOpen() {
      this.contentEl.empty();
      this.contentEl.addClass("daily-flow-modal");

      const card = createEl("section", "daily-flow-modal-card");
      const header = createEl("div", "daily-flow-modal-header");
      const date = createEl("input", "daily-flow-modal-date-input");
      date.type = "date";
      date.value = this.task.dueDate || core.formatLocalDate(new Date());
      const dateButton = createEl("button", "daily-flow-modal-date", `▦ ${formatChineseDate(date.value)}`);
      dateButton.type = "button";
      dateButton.addEventListener("click", () => {
        if (typeof date.showPicker === "function") {
          date.showPicker();
        } else {
          date.focus();
        }
      });
      date.addEventListener("change", () => {
        dateButton.textContent = `▦ ${formatChineseDate(date.value)}`;
      });
      header.appendChild(dateButton);
      header.appendChild(date);
      header.appendChild(createEl("span", "daily-flow-modal-flag", "⚐"));
      card.appendChild(header);

      const body = createEl("div", "daily-flow-modal-body");
      const titleRow = createEl("div", "daily-flow-modal-title-row");
      const title = createEl("input", "daily-flow-modal-title");
      title.type = "text";
      title.placeholder = "准备做什么？";
      title.value = this.task.title || "";
      const checklistToggle = createEl("button", "daily-flow-modal-checklist-toggle", "☷");
      checklistToggle.type = "button";
      checklistToggle.addEventListener("click", () => {
        this.task.title = title.value;
        this.task.dueDate = date.value || null;
        this.task.note = note.value;
        if (checklist) {
          this.task.subtasks = checklist.value.split("\n").map((line) => ({ title: line.trim(), completed: false }));
        }
        this.checklistOpen = !this.checklistOpen;
        this.onOpen();
      });
      titleRow.appendChild(title);
      titleRow.appendChild(checklistToggle);
      body.appendChild(titleRow);

      const note = createEl("textarea", "daily-flow-modal-note");
      note.placeholder = "描述";
      note.value = this.task.note || "";
      body.appendChild(note);

      let checklist = null;
      if (this.checklistOpen) {
        checklist = createEl("textarea", "daily-flow-modal-subtasks");
        checklist.placeholder = "换行即可添加检查事项";
        checklist.value = Array.isArray(this.task.subtasks)
          ? this.task.subtasks.map((subtask) => subtask.title).join("\n")
          : "";
        body.appendChild(checklist);
      }
      card.appendChild(body);

      const actions = createEl("div", "daily-flow-modal-actions");
      actions.appendChild(createEl("span", "daily-flow-modal-list", "▣ 收集箱"));
      const save = createEl("button", "daily-flow-primary-button", "保存");
      save.addEventListener("click", async () => {
        try {
          await this.onSave({
            title: title.value,
            dueDate: date.value || null,
            note: note.value,
            subtasks: checklist
              ? checklist.value.split("\n").map((line) => ({ title: line.trim(), completed: false }))
              : this.task.subtasks || []
          });
          this.close();
        } catch (error) {
          new Notice(error.message || "Could not save task.");
        }
      });
      actions.appendChild(save);

      if (this.task.id) {
        const remove = createEl("button", "daily-flow-danger-button", "删除");
        remove.addEventListener("click", async () => {
          await this.onDelete();
          this.close();
        });
        actions.appendChild(remove);
      }

      card.appendChild(actions);
      this.contentEl.appendChild(card);
      title.focus();
    }
  }

  class DailyFlowSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
      super(app, plugin);
      this.plugin = plugin;
    }

    display() {
      const { containerEl } = this;
      containerEl.empty();
      containerEl.createEl("h2", { text: "DailyFlow" });

      new Setting(containerEl)
        .setName("Default focus minutes")
        .addText((text) => {
          text.inputEl.type = "number";
          text.setValue(String(this.plugin.data.settings.defaultFocusMinutes));
          text.onChange(async (value) => {
            const minutes = Number(value);
            if (Number.isFinite(minutes) && minutes > 0) {
              await this.plugin.setDailyData(core.updateSettings(this.plugin.data, { defaultFocusMinutes: minutes }));
            }
          });
        });

      new Setting(containerEl)
        .setName("Week starts on")
        .addDropdown((dropdown) => {
          dropdown
            .addOption("monday", "Monday")
            .addOption("sunday", "Sunday")
            .setValue(this.plugin.data.settings.weekStartsOn)
            .onChange(async (value) => {
              await this.plugin.setDailyData(core.updateSettings(this.plugin.data, { weekStartsOn: value }));
            });
        });

      new Setting(containerEl)
        .setName("Show completed tasks")
        .addToggle((toggle) => {
          toggle
            .setValue(this.plugin.data.settings.showCompletedTasks)
            .onChange(async (value) => {
              await this.plugin.setDailyData(core.updateSettings(this.plugin.data, { showCompletedTasks: value }));
            });
        });

      new Setting(containerEl)
        .setName("Export JSON")
        .setDesc("Copy all DailyFlow tasks, focus sessions, and settings to the clipboard.")
        .addButton((button) => {
          button.setButtonText("Copy JSON").onClick(async () => {
            try {
              await navigator.clipboard.writeText(JSON.stringify(this.plugin.data, null, 2));
              new Notice("DailyFlow data copied.");
            } catch (error) {
              new Notice("Could not copy DailyFlow data.");
            }
          });
        });
    }
  }

  function createEl(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
      for (const name of className.split(" ").filter(Boolean)) {
        element.addClass(name);
      }
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function createButton(icon, label, active) {
    const button = createEl("button", "daily-flow-icon-button");
    if (active) {
      button.addClass("is-active");
    }
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.textContent = icon;
    return button;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return `${core.formatLocalDate(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function formatChineseDate(value, now = new Date()) {
    const date = core.parseLocalDate(value);
    if (!date) {
      return "无日期";
    }
    const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`;
    if (core.isToday(value, now)) {
      return `今天, ${monthDay}`;
    }
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return `${weekdays[date.getDay()]}, ${monthDay}`;
  }

  module.exports = DailyFlowPlugin;

  return module.exports;
})();

module.exports = pluginModule;
module.exports.default = pluginModule;
