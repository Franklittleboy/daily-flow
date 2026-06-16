const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("DailyFlow keeps navigation on the right and main content first", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.doesNotMatch(source, /renderRail\(\)/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(220px,\s*300px\)/);
  assert.match(styles, /\.daily-flow-main\s*{[^}]*grid-column:\s*1/s);
  assert.doesNotMatch(styles, /\.daily-flow-rail\s*{/);
  assert.match(styles, /\.daily-flow-middle\s*{[^}]*grid-column:\s*2/s);
});

test("DailyFlow exposes direct add affordances beyond the header plus button", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");

  assert.match(source, /daily-flow-add-task-row/);
  assert.match(source, /daily-flow-day-add/);
  assert.match(source, /daily-flow-week-add/);
});

test("month view renders readable task buttons inside date cells", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /daily-flow-day-top/);
  assert.match(source, /createEl\("button", "daily-flow-calendar-task"/);
  assert.match(source, /this\.openTaskDetail\(task\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(styles, /\.daily-flow-calendar-task\s*{[^}]*min-height:\s*22px/s);
  assert.match(styles, /\.daily-flow-calendar-task\s*{[^}]*font-weight:\s*600/s);
});

test("calendar task detail popover supports completion and date picking", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /openTaskDetail\(task\)/);
  assert.match(source, /renderTaskDetail\(main,\s*"popover"\)/);
  assert.match(source, /daily-flow-detail-check/);
  assert.match(source, /core\.completeTask\(this\.plugin\.data,\s*task\.id,\s*checkbox\.checked\)/);
  assert.match(source, /daily-flow-detail-date-picker/);
  assert.match(source, /renderDetailDatePicker\(task\)/);
  assert.match(source, /core\.updateTask\(this\.plugin\.data,\s*task\.id,\s*\{\s*dueDate:/s);
  assert.match(styles, /\.daily-flow-detail-card\s*{[^}]*box-shadow:\s*0 18px 48px/s);
  assert.match(styles, /\.daily-flow-date-picker-grid\s*{[^}]*grid-template-columns:\s*repeat\(7,\s*1fr\)/s);
});

test("task popovers expose TickTick-like subtasks, attachments, focus, and note conversion", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /activeTaskComposer/);
  assert.match(source, /renderTaskComposer\(main\)/);
  assert.match(source, /openTaskModal\(task\)[\s\S]*if \(!task\.id\)[\s\S]*activeTaskComposer/);
  assert.match(source, /daily-flow-modal-card/);
  assert.match(source, /daily-flow-modal-checklist-toggle/);
  assert.match(source, /换行即可添加检查事项/);
  assert.match(source, /daily-flow-detail-menu/);
  assert.match(source, /添加子任务/);
  assert.match(source, /上传附件/);
  assert.match(source, /开始专注/);
  assert.match(source, /转换为笔记/);
  assert.match(source, /startFocusForTask\(task\.id\)/);
  assert.match(source, /convertTaskToNote\(task\)/);
  assert.match(styles, /\.daily-flow-detail-layer\s*{[^}]*align-items:\s*flex-end/s);
  assert.match(styles, /\.daily-flow-detail-layer\s*{[^}]*justify-content:\s*flex-start/s);
  assert.match(styles, /\.daily-flow-modal-card\s*{[^}]*width:\s*min\(520px,\s*calc\(100% - 48px\)\)/s);
  assert.match(styles, /\.daily-flow-modal-card\s*{[^}]*min-height:\s*360px/s);
  assert.match(styles, /\.daily-flow-detail-card\s*{[^}]*width:\s*min\(520px,\s*calc\(100% - 48px\)\)/s);
  assert.match(styles, /\.daily-flow-detail-card\s*{[^}]*min-height:\s*360px/s);
  assert.match(styles, /\.daily-flow-detail-title\s*{[^}]*font-size:\s*26px/s);
  assert.match(styles, /\.daily-flow-detail-menu\s*{[^}]*box-shadow:\s*0 18px 44px/s);
  assert.match(styles, /\.daily-flow-detail-menu\s*{[^}]*right:\s*34px/s);
  assert.match(styles, /\.daily-flow-detail-menu\s*{[^}]*bottom:\s*90px/s);
  assert.match(styles, /\.daily-flow-subtask-row\s*{[^}]*grid-template-columns:\s*24px\s+minmax\(0,\s*1fr\)/s);
  assert.match(styles, /\.daily-flow-note-body\s*{[^}]*min-height:\s*150px/s);
});

test("task detail views show image attachment previews instead of only file names", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /readAttachmentFile\(file\)/);
  assert.match(source, /dataUrl/);
  assert.match(source, /renderAttachments\(task\.attachments\)/);
  assert.match(source, /renderAttachments\(this\.task\.attachments/);
  assert.match(source, /isImageAttachment\(attachment\)/);
  assert.match(source, /createEl\("img", "daily-flow-attachment-image"/);
  assert.match(source, /daily-flow-attachment-more/);
  assert.match(source, /getAttachmentSource\(attachment\)/);
  assert.match(styles, /\.daily-flow-attachments\s*{[^}]*flex-direction:\s*column/s);
  assert.match(styles, /\.daily-flow-attachment-preview\s*{[^}]*position:\s*relative/s);
  assert.match(styles, /\.daily-flow-attachment-image\s*{[^}]*width:\s*100%/s);
  assert.match(styles, /\.daily-flow-attachment-image\s*{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /\.daily-flow-attachment-more\s*{[^}]*position:\s*absolute/s);
});

test("task detail content matches TickTick-like side panel and calendar popover layout", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /const board = createEl\("div", "daily-flow-task-board"\)/);
  assert.match(source, /const list = createEl\("div", "daily-flow-task-list-pane"\)/);
  assert.match(source, /this\.renderTaskDetail\(board,\s*"panel"\)/);
  assert.match(source, /this\.renderTaskDetail\(main,\s*"popover"\)/);
  assert.match(source, /body\.addEventListener\("click", \(\) => this\.openTaskDetail\(task\)\)/);
  assert.match(source, /card\.addClass\(`is-\$\{presentation\}`\)/);
  assert.match(source, /daily-flow-detail-title-row/);
  assert.match(source, /daily-flow-detail-menu-button/);
  assert.match(source, /daily-flow-detail-content/);
  assert.match(source, /renderTaskNote\(task\)/);
  assert.match(source, /renderSubtasks\(task,\s*this\.detailSubtasksOpen\)/);
  assert.match(source, /date\.addClass\("is-overdue"\)/);
  assert.match(styles, /\.daily-flow-task-board\s*{[^}]*grid-template-columns:\s*minmax\(540px,\s*1\.08fr\)\s+minmax\(420px,\s*0\.92fr\)/s);
  assert.match(styles, /\.daily-flow-task-list-pane\s*{[^}]*overflow-x:\s*hidden/s);
  assert.match(styles, /\.daily-flow-detail-card\.is-panel\s*{[^}]*box-shadow:\s*none/s);
  assert.match(styles, /\.daily-flow-detail-card\.is-popover\s*{[^}]*box-shadow:\s*0 18px 48px/s);
  assert.match(styles, /\.daily-flow-detail-card\s*{[^}]*display:\s*flex/s);
  assert.match(styles, /\.daily-flow-detail-content\s*{[^}]*padding:\s*32px 34px/s);
  assert.match(styles, /\.daily-flow-detail-title-row\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+34px/s);
  assert.match(styles, /\.daily-flow-detail-title,\s*\.daily-flow-detail-note,\s*\.daily-flow-note-body,\s*\.daily-flow-subtask-title,\s*\.daily-flow-subtask-add\s*{[^}]*box-shadow:\s*none !important/s);
  assert.match(styles, /\.daily-flow-detail-date\s*{[^}]*background:\s*transparent/s);
  assert.match(styles, /\.daily-flow-detail-footer\s*{[^}]*margin-top:\s*auto/s);
  assert.match(styles, /\.daily-flow-detail-footer\s*{[^}]*border-top:\s*0/s);
  assert.match(styles, /\.daily-flow-detail-date\.is-overdue\s*{[^}]*color:\s*#ef4444/s);
});

test("calendar task bars use deeper todo color and lighter completed color", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /styleCalendarTask\(bar,\s*task\)/);
  assert.match(source, /styleCalendarTask\(taskButton,\s*task\)/);
  assert.match(source, /task\.completed\)[^}]*button\.addClass\("is-completed"\)/s);
  assert.match(styles, /--daily-flow-accent-bar:\s*#4f6ff2/);
  assert.match(styles, /\.daily-flow-calendar-task\.is-completed,\s*\.daily-flow-week-task\.is-completed\s*{[^}]*background:\s*#d7defc/s);
  assert.match(styles, /\.daily-flow-calendar-task\.is-completed,\s*\.daily-flow-week-task\.is-completed\s*{[^}]*color:\s*#7a8294/s);
});

test("task list rows use a single readable line with right-side date", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /daily-flow-task-date/);
  assert.doesNotMatch(source, /daily-flow-task-meta/);
  assert.match(styles, /grid-template-columns:\s*24px\s+minmax\(0,\s*1fr\)\s+minmax\(74px,\s*auto\)\s+28px/);
  assert.match(styles, /\.daily-flow-task-title\s*{[^}]*white-space:\s*normal/s);
  assert.match(styles, /\.daily-flow-task-date\s*{[^}]*justify-self:\s*end/s);
});

test("visual chrome stays light and TickTick-like", () => {
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(styles, /--daily-flow-line:\s*rgba\(142,\s*149,\s*166,\s*0\.16\)/);
  assert.match(styles, /\.daily-flow-root button\s*{[^}]*box-shadow:\s*none/s);
  assert.match(styles, /\.daily-flow-root button\s*{[^}]*appearance:\s*none/s);
  assert.match(styles, /\.daily-flow-middle\s*{[^}]*border-left:\s*1px solid var\(--daily-flow-line\)/s);
  assert.match(styles, /\.daily-flow-task-row\s*{[^}]*border-bottom:\s*1px solid var\(--daily-flow-line\)/s);
  assert.match(styles, /\.daily-flow-week-column\s*{[^}]*border:\s*0/s);
});

test("focus view follows TickTick-like pomodoro layout", () => {
  const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
  const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

  assert.match(source, /renderFocusHeader\(\)/);
  assert.match(source, /番茄专注/);
  assert.match(source, /番茄计时/);
  assert.match(source, /正计时/);
  assert.match(source, /daily-flow-focus-overview/);
  assert.match(source, /专注记录/);
  assert.match(styles, /\.daily-flow-focus-layout\s*{[^}]*grid-template-columns:\s*minmax\(420px,\s*1fr\)\s+minmax\(360px,\s*0\.92fr\)/s);
  assert.match(styles, /\.daily-flow-focus-ring\s*{[^}]*width:\s*min\(44vw,\s*440px\)/s);
  assert.match(styles, /\.daily-flow-focus-start\s*{[^}]*background:\s*var\(--daily-flow-accent\)/s);
});
