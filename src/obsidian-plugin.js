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
    this.focus = {
      taskId: null,
      running: false,
      paused: false,
      startedAt: null,
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

    shell.appendChild(this.renderRail());
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

  renderRail() {
    const rail = createEl("nav", "daily-flow-rail");
    const items = [
      ["tasks", "Tasks", "✓"],
      ["calendar", "Calendar", "▦"],
      ["focus", "Focus", "◎"]
    ];

    for (const [section, label, icon] of items) {
      const button = createButton(icon, label, this.section === section);
      button.addEventListener("click", () => {
        this.section = section;
        this.render();
      });
      rail.appendChild(button);
    }

    return rail;
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
        bar.addEventListener("click", (event) => {
          event.stopPropagation();
          this.openTaskModal(task);
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
        taskButton.addEventListener("click", () => this.openTaskModal(task));
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
    main.appendChild(this.renderHeader("Focus", () => this.openTaskModal({ dueDate: core.formatLocalDate(new Date()) })));

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

    const ring = createEl("div", "daily-flow-focus-ring");
    ring.appendChild(createEl("div", "daily-flow-focus-time", this.formatSeconds(this.focus.remainingSeconds)));

    const controls = createEl("div", "daily-flow-focus-controls");
    const primary = createEl("button", "daily-flow-primary-button", this.focus.running && !this.focus.paused ? "Pause" : this.focus.paused ? "Resume" : "Start");
    primary.addEventListener("click", () => this.toggleFocus());
    controls.appendChild(primary);

    if (this.focus.running || this.focus.paused) {
      const end = createEl("button", "daily-flow-text-button", "End");
      end.addEventListener("click", () => this.endFocus(false));
      controls.appendChild(end);
    }

    timerPane.appendChild(taskPicker);
    timerPane.appendChild(ring);
    timerPane.appendChild(controls);

    const history = createEl("aside", "daily-flow-focus-history");
    const todayKey = core.formatLocalDate(new Date());
    const todays = this.plugin.data.focusSessions.filter((session) => session.startedAt.startsWith(todayKey));
    const totalMinutes = this.plugin.data.focusSessions.reduce((sum, session) => sum + session.actualMinutes, 0);
    history.appendChild(this.renderStatCards(todays.length, todays.reduce((sum, session) => sum + session.actualMinutes, 0), this.plugin.data.focusSessions.length, totalMinutes));
    history.appendChild(createEl("h3", "", "Focus History"));

    for (const session of [...this.plugin.data.focusSessions].reverse().slice(0, 12)) {
      history.appendChild(this.renderFocusRecord(session));
    }

    layout.appendChild(timerPane);
    layout.appendChild(history);
    main.appendChild(layout);
  }

  renderStatCards(todayCount, todayMinutes, totalCount, totalMinutes) {
    const grid = createEl("div", "daily-flow-stats");
    const cards = [
      ["Today Sessions", String(todayCount)],
      ["Today Focus", `${todayMinutes}m`],
      ["Total Sessions", String(totalCount)],
      ["Total Focus", `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`]
    ];
    for (const [label, value] of cards) {
      const card = createEl("div", "daily-flow-stat");
      card.appendChild(createEl("span", "", label));
      card.appendChild(createEl("strong", "", value));
      grid.appendChild(card);
    }
    return grid;
  }

  renderFocusRecord(session) {
    const row = createEl("div", "daily-flow-focus-record");
    const task = this.plugin.data.tasks.find((item) => item.id === session.taskId);
    row.appendChild(createEl("strong", "", task ? task.title : "Free focus"));
    row.appendChild(createEl("span", "", `${formatDateTime(session.startedAt)} · ${session.actualMinutes}m`));
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

  defaultDueDateForFilter() {
    if (this.taskFilter === "today" || this.taskFilter === "next7") {
      return core.formatLocalDate(new Date());
    }
    return null;
  }

  tasksForDate(date) {
    return this.plugin.data.tasks
      .filter((task) => task.dueDate === date && (this.plugin.data.settings.showCompletedTasks || !task.completed))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
