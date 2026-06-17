const { ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting } = require("obsidian");
const core = require("./core");

const VIEW_TYPE_DAILY_FLOW = "daily-flow-view";
const IMAGE_ATTACHMENT_EXTENSIONS = new Set(["avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "webp"]);
const TASK_NAV_PANE_MIN_WIDTH = 240;
const TASK_NAV_PANE_MAX_WIDTH = 420;
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
    this.detailPickerAnchorDate = new Date();
    this.activeImagePreview = null;
    this.imagePreviewScale = 1;
    this.contextMenuTaskId = null;
    this.contextMenuPosition = null;
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
    main.addClass(`is-${this.section}`);
    main.addEventListener("click", () => {
      if (this.contextMenuTaskId) {
        this.contextMenuTaskId = null;
        this.contextMenuPosition = null;
        this.render();
      }
    });
    shell.appendChild(main);

    if (this.section === "calendar") {
      this.renderCalendar(main);
    } else if (this.section === "focus") {
      this.renderFocus(main);
    } else {
      this.renderTasks(main);
    }
    this.renderTaskComposer(main);
    this.renderTaskContextMenu(main);
    this.renderImagePreview(main);
  }

  renderMiddle() {
    const middle = createEl("aside", "daily-flow-middle");
    const title = createEl("div", "daily-flow-middle-title", "DailyFlow");
    middle.appendChild(title);

    const navItems = [
      ["tasks", "Tasks", "check-square"],
      ["calendar", "Calendar", "calendar-days"],
      ["focus", "Focus", "target"]
    ];

    for (const [section, label, icon] of navItems) {
      const item = createEl("button", "daily-flow-nav-item");
      item.setAttribute("title", label);
      item.setAttribute("aria-label", label);
      if (this.section === section) {
        item.addClass("is-active");
      }
      item.appendChild(createTickTickIcon(icon));
      item.appendChild(createEl("span", "daily-flow-nav-label", label));
      item.addEventListener("click", () => {
        this.section = section;
        this.activeTaskDetailId = null;
        this.contextMenuTaskId = null;
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
    board.style.setProperty("--daily-flow-task-nav-width", `${this.getTaskNavPaneWidth()}px`);
    board.style.setProperty("--daily-flow-task-list-width", `${this.getTaskListPaneWidth()}px`);
    board.appendChild(this.renderTaskSidebar());
    const navResizer = createEl("div", "daily-flow-task-nav-resizer");
    this.bindTaskNavResizer(board, navResizer);
    board.appendChild(navResizer);

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

    if (this.plugin.data.settings.showCompletedTasks) {
      this.renderTaskGroup(list, "Completed", this.plugin.data.tasks.filter((task) => task.completed));
    }
    board.appendChild(list);
    const detailResizer = createEl("div", "daily-flow-task-resizer");
    this.bindTaskListResizer(board, detailResizer);
    board.appendChild(detailResizer);
    this.renderTaskDetail(board, "panel");
    main.appendChild(board);
  }

  renderTaskSidebar() {
    const sidebar = createEl("aside", "daily-flow-task-sidebar");
    const todayCount = core.getTodayTasks(this.plugin.data.tasks).length;
    const weekCount = core.getNextDaysTasks(this.plugin.data.tasks, 7).length;
    const inboxCount = this.plugin.data.tasks.filter((task) => !task.completed).length;
    const items = [
      ["today", "calendar-day", "Today", todayCount],
      ["next7", "calendar-week", "Next 7 Days", weekCount],
      ["inbox", "inbox", "Inbox", inboxCount]
    ];
    for (const [filter, icon, label, count] of items) {
      const item = createEl("button", "daily-flow-task-sidebar-item");
      if (this.taskFilter === filter) {
        item.addClass("is-active");
      }
      item.appendChild(createTickTickIcon(icon));
      item.appendChild(createEl("span", "daily-flow-task-sidebar-label", label));
      item.appendChild(createEl("span", "daily-flow-task-sidebar-count", String(count)));
      item.addEventListener("click", () => {
        this.taskFilter = filter;
        this.activeTaskDetailId = null;
        this.contextMenuTaskId = null;
        this.render();
      });
      sidebar.appendChild(item);
    }

    sidebar.appendChild(createEl("div", "daily-flow-task-sidebar-divider"));
    sidebar.appendChild(createEl("div", "daily-flow-task-sidebar-heading", "Lists"));
    sidebar.appendChild(createEl("p", "daily-flow-task-sidebar-hint", "Use lists to organize your tasks and notes."));
    sidebar.appendChild(createEl("div", "daily-flow-task-sidebar-heading", "Filters"));
    sidebar.appendChild(createEl("p", "daily-flow-task-sidebar-hint", "Filter tasks by list, date, priority, and tags."));
    sidebar.appendChild(createEl("div", "daily-flow-task-sidebar-heading", "Tags"));
    sidebar.appendChild(createEl("p", "daily-flow-task-sidebar-hint", "Type # while adding a task to quickly choose tags."));
    sidebar.appendChild(createEl("div", "daily-flow-task-sidebar-spacer"));

    const completed = createEl("button", "daily-flow-task-sidebar-item");
    completed.appendChild(createTickTickIcon("check-circle"));
    completed.appendChild(createEl("span", "daily-flow-task-sidebar-label", "Completed"));
    completed.addEventListener("click", async () => {
      await this.plugin.setDailyData(core.updateSettings(this.plugin.data, {
        showCompletedTasks: !this.plugin.data.settings.showCompletedTasks
      }));
      this.render();
    });
    sidebar.appendChild(completed);

    const trash = createEl("button", "daily-flow-task-sidebar-item");
    trash.appendChild(createTickTickIcon("trash"));
    trash.appendChild(createEl("span", "daily-flow-task-sidebar-label", "Trash"));
    trash.disabled = true;
    sidebar.appendChild(trash);
    return sidebar;
  }

  getTaskNavPaneWidth() {
    return clampTaskNavPaneWidth(this.plugin.data.settings.taskNavPaneWidth);
  }

  getTaskListPaneWidth() {
    return clampTaskListPaneWidth(this.plugin.data.settings.taskListPaneWidth);
  }

  bindTaskNavResizer(board, resizer) {
    resizer.setAttribute("role", "separator");
    resizer.setAttribute("aria-orientation", "vertical");
    resizer.setAttribute("title", "Resize list sidebar");
    resizer.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = this.getTaskNavPaneWidth();
      let nextWidth = startWidth;
      board.addClass("is-resizing");

      const onMove = (moveEvent) => {
        nextWidth = clampTaskNavPaneWidth(startWidth + moveEvent.clientX - startX);
        board.style.setProperty("--daily-flow-task-nav-width", `${nextWidth}px`);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        board.removeClass("is-resizing");
        this.saveTaskNavPaneWidth(nextWidth);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
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

  async saveTaskNavPaneWidth(width) {
    await this.plugin.setDailyData(core.updateSettings(this.plugin.data, {
      taskNavPaneWidth: clampTaskNavPaneWidth(width)
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

  renderTaskRow(task) {
    const row = createEl("div", "daily-flow-task-row");
    if (task.id === this.activeTaskDetailId) {
      row.addClass("is-selected");
    }
    row.addEventListener("contextmenu", (event) => this.openTaskContextMenu(task, event));
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

  openTaskContextMenu(task, event) {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuTaskId = task.id;
    this.contextMenuPosition = { x: event.clientX, y: event.clientY };
    this.activeTaskDetailId = task.id;
    this.detailMenuOpen = false;
    this.render();
  }

  renderTaskContextMenu(container) {
    if (!this.contextMenuTaskId || !this.contextMenuPosition) {
      return;
    }
    const task = this.plugin.data.tasks.find((item) => item.id === this.contextMenuTaskId);
    if (!task) {
      this.contextMenuTaskId = null;
      return;
    }

    const menu = createEl("div", "daily-flow-task-context-menu");
    menu.style.left = `${this.contextMenuPosition.x}px`;
    menu.style.top = `${this.contextMenuPosition.y}px`;
    menu.addEventListener("click", (event) => event.stopPropagation());
    const closeMenu = () => {
      this.contextMenuTaskId = null;
      this.contextMenuPosition = null;
      this.render();
    };

    menu.appendChild(createEl("div", "daily-flow-context-label", "日期"));
    const dateRow = createEl("div", "daily-flow-context-date-row");
    const dateActions = [
      ["sun", "设为今天", () => this.setTaskDueDate(task, core.formatLocalDate(new Date()))],
      ["sunrise", "设为明天", () => this.setTaskDueDate(task, core.formatLocalDate(core.addDays(new Date(), 1)))],
      ["calendar-plus", "设为七天后", () => this.setTaskDueDate(task, core.formatLocalDate(core.addDays(new Date(), 7)))],
      ["calendar-days", "自定义日期", () => this.openCustomDateInput(task, menu)],
      ["calendar-x", "清除日期", () => this.setTaskDueDate(task, null)]
    ];
    for (const [icon, label, action] of dateActions) {
      const button = createEl("button", "daily-flow-context-date-button");
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.appendChild(createTickTickIcon(icon));
      button.addEventListener("click", action);
      dateRow.appendChild(button);
    }
    menu.appendChild(dateRow);

    menu.appendChild(createEl("div", "daily-flow-context-label", "优先级"));
    const priorityRow = createEl("div", "daily-flow-context-priority-row");
    for (const color of ["red", "amber", "blue", "gray"]) {
      const button = createEl("button", `daily-flow-context-priority is-${color} daily-flow-context-placeholder`);
      button.appendChild(createTickTickIcon("flag"));
      button.disabled = true;
      priorityRow.appendChild(button);
    }
    menu.appendChild(priorityRow);

    const addItem = (icon, label, action, disabled = false, arrow = false) => {
      const item = createEl("button", disabled ? "daily-flow-context-item daily-flow-context-placeholder" : "daily-flow-context-item");
      item.appendChild(createTickTickIcon(icon));
      item.appendChild(createEl("span", "", label));
      if (arrow) {
        item.appendChild(createEl("span", "daily-flow-context-arrow", "›"));
      }
      item.disabled = disabled;
      if (action) {
        item.addEventListener("click", async () => {
          await action();
          closeMenu();
        });
      }
      menu.appendChild(item);
    };

    addItem("subtask", "添加子任务", null, true);
    addItem("pin", "置顶", null, true);
    addItem("archive-x", "放弃", null, true);
    addItem("move-right", "移动到", null, true, true);
    addItem("tag", "标签", null, true, true);
    addItem("target", "开始专注", () => this.startFocusForTask(task.id), false, true);
    addItem("copy", "创建副本", null, true);
    addItem("link", "复制链接", null, true);
    addItem("sticky-note", "打开便签", null, true);
    addItem("trash", "删除", async () => {
      await this.plugin.setDailyData(core.deleteTask(this.plugin.data, task.id));
      if (this.activeTaskDetailId === task.id) {
        this.activeTaskDetailId = null;
      }
    });

    container.appendChild(menu);
    this.positionTaskContextMenu(menu);
  }

  positionTaskContextMenu(menu) {
    if (!this.contextMenuPosition) {
      return;
    }
    const margin = 12;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    let left = this.contextMenuPosition.x;
    let top = this.contextMenuPosition.y;

    if (left + rect.width + margin > viewportWidth) {
      left = viewportWidth - rect.width - margin;
    }
    if (top + rect.height + margin > viewportHeight) {
      top = this.contextMenuPosition.y - rect.height;
    }

    left = Math.max(margin, Math.min(left, viewportWidth - rect.width - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - rect.height - margin));
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }

  async setTaskDueDate(task, dueDate) {
    await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, { dueDate }));
    this.contextMenuTaskId = null;
    this.contextMenuPosition = null;
    this.render();
  }

  openCustomDateInput(task, menu) {
    const input = createEl("input", "daily-flow-context-date-input");
    input.type = "date";
    input.value = task.dueDate || core.formatLocalDate(new Date());
    input.addEventListener("change", () => this.setTaskDueDate(task, input.value || null));
    menu.appendChild(input);
    input.showPicker?.();
    input.focus();
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
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.target instanceof Element ? event.target : null;
      if (
        this.detailDatePickerOpen &&
        target &&
        !target.closest(".daily-flow-detail-date-picker") &&
        !target.closest(".daily-flow-detail-date")
      ) {
        this.detailDatePickerOpen = false;
        this.render();
      }
    });

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
    const date = createEl("button", "daily-flow-detail-date", this.taskDetailDateLabel(task));
    if (task.dueDate && task.dueDate < core.formatLocalDate(new Date()) && !task.completed) {
      date.addClass("is-overdue");
    }
    date.addEventListener("click", (event) => {
      event.stopPropagation();
      this.detailDatePickerOpen = !this.detailDatePickerOpen;
      this.detailMenuOpen = false;
      this.detailPickerAnchorDate = core.parseLocalDate(task.dueDate) || this.detailPickerAnchorDate || new Date();
      this.render();
    });
    header.appendChild(date);
    header.appendChild(createEl("span", "daily-flow-detail-flag", "⚐"));
    card.appendChild(header);

    if (this.detailDatePickerOpen) {
      card.appendChild(this.renderDetailDatePicker(task));
    }

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
    content.appendChild(titleRow);

    content.appendChild(this.renderTaskMarkdownBody(task));

    content.appendChild(renderAttachments(task.attachments, (attachment) => this.openImagePreview(attachment)));
    card.appendChild(content);

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

  renderTaskMarkdownBody(task) {
    const body = createEl("textarea", "daily-flow-detail-md-body");
    body.placeholder = "写描述、Markdown、- [ ] 待办、- 无序列表";
    body.value = this.getTaskMarkdownText(task);
    body.addEventListener("blur", async () => {
      if (body.value !== task.note) {
        await this.plugin.setDailyData(core.updateTask(this.plugin.data, task.id, { note: body.value }));
        this.render();
      }
    });
    return body;
  }

  getTaskMarkdownText(task) {
    if (task.note.trim()) {
      return task.note;
    }
    return task.subtasks
      .map((subtask) => `- [${subtask.completed ? "x" : " "}] ${subtask.title}`)
      .join("\n");
  }

  renderDetailMenu(task) {
    const menu = createEl("div", "daily-flow-detail-menu");
    const items = [
      ["☒", "放弃", null],
      ["◇", "标签", null],
      ["⌕", "上传附件", () => this.uploadAttachment(task)],
      ["◎", "开始专注", () => this.startFocusForTask(task.id), true],
      ["▦", "任务动态", null],
      ["T", "保存为模板", null],
      ["▢", "创建副本", null],
      ["↪", "复制链接", null],
      ["▱", "打开便签", null],
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

const TICKTICK_ICONS = {
  "check-square": '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"></rect><path d="m8 12 2.6 2.6L16.5 9"></path></svg>',
  "calendar-days": '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"></rect><path d="M8 3v4M16 3v4M4 10h16M8 14h2M12 14h2M16 14h2M8 17h2M12 17h2"></path></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle></svg>',
  "calendar-day": '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"></rect><path d="M8 3v4M16 3v4M4 10h16"></path><path d="M10 15h4"></path></svg>',
  "calendar-week": '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"></rect><path d="M8 3v4M16 3v4M4 10h16"></path><path d="M8 15h8"></path></svg>',
  inbox: '<svg viewBox="0 0 24 24"><path d="M5 11 8 5h8l3 6v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"></path><path d="M5 12h4l1.5 2h3L15 12h4"></path></svg>',
  "check-circle": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="m8.5 12 2.2 2.2 4.8-5"></path></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13"></path></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"></path></svg>',
  sunrise: '<svg viewBox="0 0 24 24"><path d="M4 18h16M7 15a5 5 0 0 1 10 0M12 3v7M8 7l4-4 4 4"></path></svg>',
  "calendar-plus": '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"></rect><path d="M8 3v4M16 3v4M4 10h16M12 13v4M10 15h4"></path><path d="M7.5 15.5h1.8M8.4 14.6v1.8"></path></svg>',
  "calendar-x": '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"></rect><path d="M8 3v4M16 3v4M4 10h16M10 14l4 4M14 14l-4 4"></path></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M6 20V5h10l-1.5 4L16 13H6"></path></svg>',
  subtask: '<svg viewBox="0 0 24 24"><path d="M5 7h6M5 12h10M5 17h14"></path><path d="M17 6v4M15 8h4"></path></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="m8 14-3 5 5-3 7-7 2-4-4 2z"></path></svg>',
  "archive-x": '<svg viewBox="0 0 24 24"><path d="M4 7h16v13H4zM4 4h16v3H4zM9 12l6 6M15 12l-6 6"></path></svg>',
  "move-right": '<svg viewBox="0 0 24 24"><path d="M4 7h10M4 12h14M4 17h10M16 9l3 3-3 3"></path></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M4 12V5h7l9 9-7 7z"></path><circle cx="8" cy="9" r="1"></circle></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M5 15V6a1 1 0 0 1 1-1h9"></path></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M9.5 14.5 14.5 9.5"></path><path d="M8 11a4 4 0 0 1 0-6l1-1a4 4 0 0 1 6 6l-1 1"></path><path d="M10 13l-1 1a4 4 0 0 0 6 6l1-1a4 4 0 0 0 0-6"></path></svg>',
  "sticky-note": '<svg viewBox="0 0 24 24"><path d="M6 4h12v11l-5 5H6z"></path><path d="M13 20v-5h5"></path></svg>',
  "file-text": '<svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7z"></path><path d="M14 3v5h5M9 12h6M9 16h6"></path></svg>'
};

function createTickTickIcon(name) {
  const icon = createEl("span", "daily-flow-ticktick-icon");
  icon.innerHTML = TICKTICK_ICONS[name] || "";
  return icon;
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

function clampTaskNavPaneWidth(width) {
  return Math.min(TASK_NAV_PANE_MAX_WIDTH, Math.max(TASK_NAV_PANE_MIN_WIDTH, Math.round(Number(width) || 320)));
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
