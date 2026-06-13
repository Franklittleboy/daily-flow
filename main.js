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
      this.detailDatePickerOpen = false;
      this.detailPickerAnchorDate = new Date();
      this.focus = {
        taskId: null,
        running: false,
        paused: false,
        mode: "pomodoro",
        startedAt: null,
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
        : "Week View";
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
        const dayNumber = createEl("button", "daily-flow-day-number", String(Number(cell.date.slice(8, 10))));
        dayNumber.addEventListener("click", (event) => {
          event.stopPropagation();
          this.openTaskModal({ dueDate: cell.date });
        });
        const add = createEl("button", "daily-flow-day-add", "+ Add");
        add.addEventListener("click", (event) => {
          event.stopPropagation();
          this.openTaskModal({ dueDate: cell.date });
        });
        dayTop.appendChild(dayNumber);
        dayTop.appendChild(add);
        day.appendChild(dayTop);

        const tasks = this.tasksForDate(cell.date);
        for (const task of tasks.slice(0, 4)) {
          const bar = createEl("button", "daily-flow-calendar-task", task.title);
          this.styleCalendarTask(bar, task);
          bar.addEventListener("click", (event) => {
            event.stopPropagation();
            this.openTaskDetail(task);
          });
          day.appendChild(bar);
        }
        if (tasks.length > 4) {
          day.appendChild(createEl("span", "daily-flow-more", `+${tasks.length - 4}`));
        }
        day.addEventListener("click", () => this.openTaskModal({ dueDate: cell.date }));
        grid.appendChild(day);
      }
      main.appendChild(grid);
    }

    renderWeek(main) {
      const week = createEl("div", "daily-flow-week");
      const days = core.getWeekDays(this.anchorDate, this.plugin.data.settings.weekStartsOn);

      for (const date of days) {
        const column = createEl("section", "daily-flow-week-column");
        const title = createEl("button", "daily-flow-week-date", date);
        title.addEventListener("click", () => this.openTaskModal({ dueDate: date }));
        column.appendChild(title);
        const tasks = this.tasksForDate(date);
        if (tasks.length === 0) {
          column.appendChild(createEl("p", "daily-flow-empty", "No tasks"));
        }
        for (const task of tasks) {
          const taskButton = createEl("button", "daily-flow-week-task", task.title);
          this.styleCalendarTask(taskButton, task);
          taskButton.addEventListener("click", () => this.openTaskDetail(task));
          column.appendChild(taskButton);
        }
        const add = createEl("button", "daily-flow-week-add", "+ Add task");
        add.addEventListener("click", () => this.openTaskModal({ dueDate: date }));
        column.appendChild(add);
        week.appendChild(column);
      }

      main.appendChild(week);
    }

    renderFocus(main) {
      main.appendChild(this.renderFocusHeader());

      const layout = createEl("div", "daily-flow-focus-layout");
      const timerPane = createEl("section", "daily-flow-focus-timer");
      const taskPicker = createEl("select", "daily-flow-select daily-flow-focus-select");
      const none = createEl("option", "", "No task");
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
      });

      const focusHint = createEl("button", "daily-flow-focus-link", taskPicker.selectedOptions[0]?.textContent || "专注");
      focusHint.addEventListener("click", () => taskPicker.focus());

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

      timerPane.appendChild(taskPicker);
      timerPane.appendChild(focusHint);
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

    openTaskDetail(task) {
      if (!task?.id) {
        return;
      }
      this.activeTaskDetailId = task.id;
      this.detailDatePickerOpen = false;
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
          this.render();
        }
      });

      const card = createEl("section", "daily-flow-detail-card");
      card.addEventListener("click", (event) => event.stopPropagation());

      const header = createEl("div", "daily-flow-detail-header");
      const checkbox = createEl("input", "daily-flow-detail-check");
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.addEventListener("change", async () => {
        await this.plugin.setDailyData(core.completeTask(this.plugin.data, task.id, checkbox.checked));
        this.render();
      });
      header.appendChild(checkbox);
      header.appendChild(createEl("span", "daily-flow-detail-separator", ""));

      const date = createEl("button", "daily-flow-detail-date", this.taskDetailDateLabel(task));
      date.addEventListener("click", () => {
        this.detailDatePickerOpen = !this.detailDatePickerOpen;
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

      if (this.detailDatePickerOpen) {
        card.appendChild(this.renderDetailDatePicker(task));
      }

      const footer = createEl("div", "daily-flow-detail-footer");
      footer.appendChild(createEl("span", "daily-flow-detail-list", "▣ Inbox"));
      const close = createEl("button", "daily-flow-detail-close", "Done");
      close.addEventListener("click", () => {
        this.activeTaskDetailId = null;
        this.detailDatePickerOpen = false;
        this.render();
      });
      footer.appendChild(close);
      card.appendChild(footer);

      layer.appendChild(card);
      main.appendChild(layer);
    }

    renderDetailDatePicker(task) {
      const picker = createEl("div", "daily-flow-detail-date-picker");
      const tabs = createEl("div", "daily-flow-date-picker-tabs");
      tabs.appendChild(createEl("span", "is-active", "Date"));
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
      const clear = createEl("button", "daily-flow-date-picker-clear", "Clear");
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
        return "No date";
      }
      if (core.isToday(task.dueDate)) {
        return `Today, ${task.dueDate.slice(5)}`;
      }
      return task.dueDate;
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
      this.focus.elapsedSeconds = 0;
      this.focus.plannedMinutes = this.plugin.data.settings.defaultFocusMinutes;
      this.focus.remainingSeconds = this.focus.plannedMinutes * 60;
    }

    toggleFocus() {
      if (!this.focus.running && !this.focus.paused) {
        this.focus.running = true;
        this.focus.startedAt = new Date();
        this.startFocusInterval();
      } else if (this.focus.running) {
        this.focus.running = false;
        this.focus.paused = true;
        this.stopFocusInterval();
      } else if (this.focus.paused) {
        this.focus.running = true;
        this.focus.paused = false;
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

    async endFocus(completed) {
      if (!this.focus.startedAt) {
        this.resetFocusTimer();
        this.render();
        return;
      }
      const endedAt = new Date();
      const elapsedSeconds = Math.max(0, Math.round((endedAt.getTime() - this.focus.startedAt.getTime()) / 1000));
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
    }

    onOpen() {
      this.contentEl.empty();
      this.contentEl.addClass("daily-flow-modal");
      this.contentEl.appendChild(createEl("h2", "", this.task.id ? "Edit Task" : "New Task"));

      const title = this.field("Title", "text", this.task.title || "");
      const date = this.field("Date", "date", this.task.dueDate || "");
      const noteLabel = createEl("label", "daily-flow-field");
      noteLabel.appendChild(createEl("span", "", "Note"));
      const note = createEl("textarea", "daily-flow-input");
      note.value = this.task.note || "";
      noteLabel.appendChild(note);
      this.contentEl.appendChild(noteLabel);

      const actions = createEl("div", "daily-flow-modal-actions");
      const save = createEl("button", "daily-flow-primary-button", "Save");
      save.addEventListener("click", async () => {
        try {
          await this.onSave({
            title: title.value,
            dueDate: date.value || null,
            note: note.value
          });
          this.close();
        } catch (error) {
          new Notice(error.message || "Could not save task.");
        }
      });
      actions.appendChild(save);

      if (this.task.id) {
        const remove = createEl("button", "daily-flow-danger-button", "Delete");
        remove.addEventListener("click", async () => {
          await this.onDelete();
          this.close();
        });
        actions.appendChild(remove);
      }

      this.contentEl.appendChild(actions);
      title.focus();
    }

    field(label, type, value) {
      const wrapper = createEl("label", "daily-flow-field");
      wrapper.appendChild(createEl("span", "", label));
      const input = createEl("input", "daily-flow-input");
      input.type = type;
      input.value = value;
      wrapper.appendChild(input);
      this.contentEl.appendChild(wrapper);
      return input;
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

  module.exports = DailyFlowPlugin;

  return module.exports;
})();

module.exports = pluginModule;
module.exports.default = pluginModule;
