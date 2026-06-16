const { ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting } = require("obsidian");
const core = require("./core");

const VIEW_TYPE_DAILY_FLOW = "daily-flow-view";
const IMAGE_ATTACHMENT_EXTENSIONS = new Set(["avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "webp"]);
const TASK_LIST_PANE_MIN_WIDTH = 360;
const TASK_LIST_PANE_MAX_WIDTH = 760;

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
    this.activeImagePreview = null;
    this.imagePreviewScale = 1;
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
    main.addClass(`is-${this.section}`);
    shell.appendChild(main);

    if (this.section === "calendar") {
      this.renderCalendar(main);
    } else if (this.section === "focus") {
      this.renderFocus(main);
    } else {
      this.renderTasks(main);
    }
    this.renderTaskComposer(main);
    this.renderImagePreview(main);
  }

  renderMiddle() {
    const middle = createEl("aside", "daily-flow-middle");
    const title = createEl("div", "daily-flow-middle-title", "DailyFlow");
    middle.appendChild(title);

    const todayCount = core.getTodayTasks(this.plugin.data.tasks).length;
    const weekCount = core.getNextDaysTasks(this.plugin.data.tasks, 7).length;
    const inboxCount = this.plugin.data.tasks.filter((task) => !task.completed).length;

    const navItems = [
      ["tasks", "today", "Today", todayCount, "▣"],
      ["tasks", "next7", "Next 7 Days", weekCount, "▤"],
      ["tasks", "inbox", "Inbox", inboxCount, "▱"],
      ["calendar", "calendar", "Calendar", null, "▦"],
      ["focus", "focus", "Focus", null, "◎"]
    ];

    for (const [section, filter, label, count, icon] of navItems) {
      const item = createEl("button", "daily-flow-nav-item");
      item.setAttribute("title", label);
      item.setAttribute("aria-label", label);
      if (this.section === section && (section !== "tasks" || this.taskFilter === filter)) {
        item.addClass("is-active");
      }
      item.appendChild(createEl("span", "daily-flow-nav-icon", icon));
      item.appendChild(createEl("span", "daily-flow-nav-label", label));
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

    const board = createEl("div", "daily-flow-task-board");
    board.style.setProperty("--daily-flow-task-list-width", `${this.getTaskListPaneWidth()}px`);
    const list = createEl("div", "daily-flow-task-list-pane");
    list.appendChild(this.renderHeader(label, () => this.openTaskModal({ dueDate: this.defaultDueDateForFilter() })));

    if (this.taskFilter === "inbox") {
      const groups = core.groupInboxTasks(this.plugin.data.tasks);
      this.renderTaskGroup(list, "Overdue", groups.overdue);
      this.renderTaskGroup(list, "Today", groups.today);
      this.renderTaskGroup(list, "Future", groups.future);
      this.renderTaskGroup(list, "No Date", groups.noDate);
    } else {
      const tasks = this.taskFilter === "today"
        ? core.getTodayTasks(this.plugin.data.tasks)
        : core.getNextDaysTasks(this.plugin.data.tasks, 7);
      this.renderTaskGroup(list, label, tasks);
    }

    list.appendChild(this.renderAddTaskRow(this.defaultDueDateForFilter()));

    if (this.plugin.data.settings.showCompletedTasks) {
      this.renderTaskGroup(list, "Completed", this.plugin.data.tasks.filter((task) => task.completed));
    }
    board.appendChild(list);
    const resizer = createEl("div", "daily-flow-task-resizer");
    this.bindTaskListResizer(board, resizer);
    board.appendChild(resizer);
    this.renderTaskDetail(board, "panel");
    main.appendChild(board);
  }

  getTaskListPaneWidth() {
    return clampTaskListPaneWidth(this.plugin.data.settings.taskListPaneWidth);
  }

  bindTaskListResizer(board, resizer) {
    resizer.setAttribute("role", "separator");
    resizer.setAttribute("aria-orientation", "vertical");
    resizer.setAttribute("title", "Resize task list");
    resizer.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = this.getTaskListPaneWidth();
      let nextWidth = startWidth;
      board.addClass("is-resizing");

      const onMove = (moveEvent) => {
        nextWidth = clampTaskListPaneWidth(startWidth + moveEvent.clientX - startX);
        board.style.setProperty("--daily-flow-task-list-width", `${nextWidth}px`);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        board.removeClass("is-resizing");
        this.saveTaskListPaneWidth(nextWidth);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  async saveTaskListPaneWidth(width) {
    await this.plugin.setDailyData(core.updateSettings(this.plugin.data, {
      taskListPaneWidth: clampTaskListPaneWidth(width)
    }));
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
    if (task.id === this.activeTaskDetailId) {
      row.addClass("is-selected");
    }
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
    body.addEventListener("click", () => this.openTaskDetail(task));

    const date = createEl("button", "daily-flow-task-date", this.taskDateLabel(task));
    date.addEventListener("click", () => this.openTaskDetail(task));

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
    this.renderTaskDetail(main, "popover");
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

  renderTaskDetail(container, presentation = "popover") {
    if (!this.activeTaskDetailId) {
      return;
    }
    const task = this.plugin.data.tasks.find((item) => item.id === this.activeTaskDetailId);
    if (!task) {
      this.activeTaskDetailId = null;
      this.detailDatePickerOpen = false;
      return;
    }

    const layer = presentation === "popover" ? createEl("div", "daily-flow-detail-layer") : null;
    if (layer) {
      layer.addEventListener("click", (event) => {
        if (event.target === layer) {
          this.activeTaskDetailId = null;
          this.detailDatePickerOpen = false;
          this.detailMenuOpen = false;
          this.render();
        }
      });
    }

    const card = createEl("section", "daily-flow-detail-card");
    card.addClass(`is-${presentation}`);
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
    if (task.dueDate && task.dueDate < core.formatLocalDate(new Date()) && !task.completed) {
      date.addClass("is-overdue");
    }
    date.addEventListener("click", () => {
      this.detailDatePickerOpen = !this.detailDatePickerOpen;
      this.detailMenuOpen = false;
      this.detailPickerAnchorDate = core.parseLocalDate(task.dueDate) || this.detailPickerAnchorDate || new Date();
      this.render();
    });
    header.appendChild(date);
    header.appendChild(createEl("span", "daily-flow-detail-flag", "⚐"));
    card.appendChild(header);

    const content = createEl("div", "daily-flow-detail-content");
    const titleRow = createEl("div", "daily-flow-detail-title-row");
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
    titleRow.appendChild(title);
    const menuButton = createEl("button", "daily-flow-detail-menu-button", "☰");
    menuButton.addEventListener("click", () => {
      this.detailMenuOpen = !this.detailMenuOpen;
      this.detailDatePickerOpen = false;
      this.render();
    });
    titleRow.appendChild(menuButton);
    content.appendChild(titleRow);

    content.appendChild(this.renderTaskNote(task));
    if (task.kind !== "note" && (this.detailSubtasksOpen || task.subtasks.length > 0)) {
      content.appendChild(this.renderSubtasks(task, this.detailSubtasksOpen));
    }

    content.appendChild(renderAttachments(task.attachments, (attachment) => this.openImagePreview(attachment)));
    card.appendChild(content);

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

    if (layer) {
      layer.appendChild(card);
      container.appendChild(layer);
    } else {
      container.appendChild(card);
    }
  }

  renderTaskNote(task) {
    const note = createEl("textarea", task.kind === "note" ? "daily-flow-note-body" : "daily-flow-detail-note");
    note.placeholder = task.kind === "note" ? "记录你的想法，或 使用模板" : "描述";
    note.value = task.note || "";
    note.addEventListener("blur", async () => {
      if (note.value !== task.note) {
        await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, { note: note.value }));
        this.render();
      }
    });
    return note;
  }

  renderSubtasks(task, showAdd) {
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

    if (showAdd) {
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
    }
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
      const attachment = {
        name: file.name,
        path: file.path || "",
        mime: file.type || ""
      };
      if (isLikelyImageAttachment(file.name, file.type)) {
        attachment.dataUrl = await readAttachmentFile(file);
      }
      await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, {
        attachments: [...task.attachments, attachment]
      }));
      this.detailMenuOpen = false;
      this.render();
    });
    input.click();
  }

  openImagePreview(attachment) {
    const source = getAttachmentSource(attachment);
    if (!source) {
      return;
    }
    this.activeImagePreview = attachment;
    this.imagePreviewScale = 1;
    this.detailMenuOpen = false;
    this.render();
  }

  closeImagePreview() {
    this.activeImagePreview = null;
    this.imagePreviewScale = 1;
    this.render();
  }

  setImagePreviewScale(scale) {
    this.imagePreviewScale = Math.min(3, Math.max(0.5, Math.round(scale * 100) / 100));
    this.render();
  }

  renderImagePreview(container) {
    if (!this.activeImagePreview) {
      return;
    }
    const source = getAttachmentSource(this.activeImagePreview);
    if (!source) {
      return;
    }

    const layer = createEl("div", "daily-flow-image-preview-layer");
    layer.addEventListener("click", (event) => {
      if (event.target === layer) {
        this.closeImagePreview();
      }
    });

    const card = createEl("div", "daily-flow-image-preview-card");
    card.addEventListener("click", (event) => event.stopPropagation());
    const toolbar = createEl("div", "daily-flow-image-preview-toolbar");
    const close = createEl("button", "daily-flow-image-preview-close", "×");
    close.setAttribute("aria-label", "Close image preview");
    close.addEventListener("click", () => this.closeImagePreview());
    toolbar.appendChild(close);
    toolbar.appendChild(createEl("span", "daily-flow-image-preview-title", this.activeImagePreview.name || "Image"));
    const controls = createEl("div", "daily-flow-image-preview-controls");
    const zoomOut = createEl("button", "daily-flow-image-preview-control", "−");
    zoomOut.setAttribute("aria-label", "Zoom out");
    zoomOut.addEventListener("click", () => this.setImagePreviewScale(this.imagePreviewScale - 0.25));
    const reset = createEl("button", "daily-flow-image-preview-control", `${Math.round(this.imagePreviewScale * 100)}%`);
    reset.setAttribute("aria-label", "Reset zoom");
    reset.addEventListener("click", () => this.setImagePreviewScale(1));
    const zoomIn = createEl("button", "daily-flow-image-preview-control", "+");
    zoomIn.setAttribute("aria-label", "Zoom in");
    zoomIn.addEventListener("click", () => this.setImagePreviewScale(this.imagePreviewScale + 0.25));
    controls.appendChild(zoomOut);
    controls.appendChild(reset);
    controls.appendChild(zoomIn);
    toolbar.appendChild(controls);
    card.appendChild(toolbar);

    const stage = createEl("div", "daily-flow-image-preview-stage");
    stage.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.setImagePreviewScale(this.imagePreviewScale + (event.deltaY < 0 ? 0.1 : -0.1));
    }, { passive: false });
    stage.style.setProperty("--daily-flow-image-scale", String(this.imagePreviewScale));
    const image = createEl("img", "daily-flow-image-preview-image");
    image.src = source;
    image.alt = this.activeImagePreview.name || "Image preview";
    stage.appendChild(image);
    card.appendChild(stage);
    layer.appendChild(card);
    container.appendChild(layer);
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
    const due = core.parseLocalDate(task.dueDate);
    const today = new Date();
    const todayDate = core.formatLocalDate(today);
    if (due && task.dueDate < todayDate && !task.completed) {
      const todayStart = core.parseLocalDate(todayDate);
      const overdueDays = todayStart ? Math.max(1, Math.round((todayStart.getTime() - due.getTime()) / 86400000)) : 1;
      return `${due.getMonth() + 1}月${due.getDate()}日, 延期${overdueDays}天`;
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
    body.appendChild(renderAttachments(this.task.attachments || []));
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

function renderAttachments(attachments, onPreview) {
  const section = createEl("div", "daily-flow-attachments");
  if (!Array.isArray(attachments) || attachments.length === 0) {
    section.addClass("is-empty");
    return section;
  }

  for (const attachment of attachments) {
    if (isImageAttachment(attachment)) {
      const preview = createEl("div", "daily-flow-attachment-preview");
      const image = createEl("img", "daily-flow-attachment-image");
      image.src = getAttachmentSource(attachment);
      image.alt = attachment.name;
      image.loading = "lazy";
      preview.appendChild(image);
      preview.addEventListener("click", () => onPreview?.(attachment));
      const more = createEl("button", "daily-flow-attachment-more", "…");
      more.setAttribute("aria-label", "Preview image");
      more.addEventListener("click", (event) => {
        event.stopPropagation();
        onPreview?.(attachment);
      });
      preview.appendChild(more);
      section.appendChild(preview);
    } else {
      section.appendChild(createEl("span", "daily-flow-attachment", `⌘ ${attachment.name}`));
    }
  }
  return section;
}

function isImageAttachment(attachment) {
  const source = getAttachmentSource(attachment);
  const mime = typeof attachment?.mime === "string" ? attachment.mime : "";
  const name = typeof attachment?.name === "string" ? attachment.name : "";
  return Boolean(source && isLikelyImageAttachment(name || source, mime || source));
}

function getAttachmentSource(attachment) {
  const dataUrl = typeof attachment?.dataUrl === "string" ? attachment.dataUrl.trim() : "";
  if (dataUrl) {
    return dataUrl;
  }
  const path = typeof attachment?.path === "string" ? attachment.path.trim() : "";
  if (!path) {
    return "";
  }
  if (/^(?:app|blob|data|file|https?):/i.test(path)) {
    return path;
  }
  if (path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path)) {
    return `file://${encodeURI(path)}`;
  }
  return "";
}

function isLikelyImageAttachment(name, mime = "") {
  if (typeof mime === "string" && mime.toLowerCase().startsWith("image/")) {
    return true;
  }
  const value = typeof name === "string" ? name : "";
  const extension = value.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  return Boolean(extension && IMAGE_ATTACHMENT_EXTENSIONS.has(extension));
}

function readAttachmentFile(file) {
  return new Promise((resolve) => {
    if (typeof FileReader === "undefined") {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    });
    reader.addEventListener("error", () => resolve(""));
    reader.readAsDataURL(file);
  });
}

function clampTaskListPaneWidth(width) {
  return Math.min(TASK_LIST_PANE_MAX_WIDTH, Math.max(TASK_LIST_PANE_MIN_WIDTH, Math.round(Number(width) || 540)));
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
