const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = readFileSync(path.resolve(__dirname, "obsidian-plugin.js"), "utf8");
const styles = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

test("task detail keeps accepted sidebar, markdown, attachment, and menu behavior", () => {
  assert.match(source, /daily-flow-task-resizer/);
  assert.match(source, /daily-flow-detail-card/);
  assert.match(source, /daily-flow-detail-md-body/);
  assert.match(source, /daily-flow-image-preview-layer/);
  assert.match(source, /renderTaskContextMenu/);
  assert.match(source, /renderDetailDatePicker/);
  assert.match(styles, /\.daily-flow-detail-card\.is-panel\s*{/);
});

test("task columns keep navigation, headers, title, and footer outside scrolling content", () => {
  assert.match(source, /const listScroll = createEl\("div", "daily-flow-task-list-scroll"\)/);
  assert.match(source, /list\.appendChild\(listScroll\)/);
  assert.match(
    source,
    /content\.appendChild\(this\.renderTaskMarkdownBody\(task\)\)/
  );
  assert.match(source, /card\.appendChild\(titleRow\);\s*const content = createEl\("div", "daily-flow-detail-content"\)/s);
  assert.match(styles, /\.daily-flow-task-sidebar\s*{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.daily-flow-task-list-pane\s*{[^}]*display:\s*flex/s);
  assert.match(styles, /\.daily-flow-task-list-pane\s*{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.daily-flow-task-list-scroll\s*{[^}]*overflow-y:\s*auto/s);
  assert.match(styles, /\.daily-flow-detail-title-row\s*{[^}]*flex:\s*0 0 auto/s);
  assert.match(styles, /\.daily-flow-detail-content\s*{[^}]*overflow-y:\s*auto/s);
  assert.match(styles, /\.daily-flow-detail-footer\s*{[^}]*flex:\s*0 0 auto/s);
});

test("task menus close on outside pointer input without closing on menu input", () => {
  assert.match(source, /dismissTaskMenusForTarget\(target\)/);
  assert.match(source, /dismissTaskMenusForTarget\(target\)\s*{/);
  assert.match(source, /target\.closest\("\.daily-flow-task-context-menu"\)/);
  assert.match(source, /target\.closest\("\.daily-flow-detail-menu"\)/);
  assert.match(source, /target\.closest\("\.daily-flow-detail-more"\)/);
});

test("task markdown lists support indentation and collapsible nested items", () => {
  assert.match(source, /indentWithTab/);
  assert.match(source, /dailyFlowListFolding\(\)/);
  assert.match(source, /class ListFoldWidget extends WidgetType/);
  assert.match(source, /daily-flow-cm-fold-toggle/);
  assert.match(source, /daily-flow-cm-folded-line/);
  assert.match(styles, /\.daily-flow-cm-fold-toggle\s*{/);
  assert.match(styles, /\.daily-flow-detail-md-body \.cm-line\.daily-flow-cm-folded-line\s*{[^}]*display:\s*none !important/s);
});

test("only the item that hides descendants shows a spaced collapsed summary", () => {
  assert.match(source, /class ListFoldSummaryWidget extends WidgetType/);
  assert.match(source, /summary\.className = "daily-flow-cm-fold-summary"/);
  assert.match(source, /summary\.textContent = "\.\.\."/);
  assert.match(
    source,
    /if \(!isCollapsed\)\s*{\s*continue;\s*}\s*ranges\.push\(Decoration\.widget\({\s*widget: new ListFoldSummaryWidget\(\),\s*side: 1\s*}\)\.range\(line\.to\)\)/s
  );
  assert.match(styles, /\.daily-flow-cm-fold-summary\s*{[^}]*margin-left:\s*1em/s);
});

test("nested markdown items show TickTick-like depth guides and keep the parent visible", () => {
  assert.match(source, /getMarkdownListDepth\(indent\)/);
  assert.match(source, /daily-flow-cm-list-line/);
  assert.match(source, /--daily-flow-list-depth/);
  assert.match(source, /childLine\.from/);
  assert.match(source, /"chevron-down":\s*'<svg/);
  assert.match(source, /"chevron-right":\s*'<svg/);
  assert.match(styles, /\.daily-flow-detail-md-body \.cm-line\.daily-flow-cm-list-line\s*{[^}]*padding-left:\s*calc\(var\(--daily-flow-list-depth\) \* 1em\)/s);
  assert.match(styles, /\.daily-flow-detail-md-body \.cm-content\s*{[^}]*padding-left:\s*24px/s);
  assert.match(styles, /\.daily-flow-cm-fold-toggle\s*{[^}]*opacity:\s*0/s);
  assert.match(styles, /\.daily-flow-cm-fold-toggle\s*{[^}]*pointer-events:\s*none/s);
  assert.match(styles, /\.daily-flow-detail-md-body \.cm-line:hover \.daily-flow-cm-fold-toggle\s*{[^}]*opacity:\s*1/s);
  assert.match(styles, /\.daily-flow-detail-md-body \.cm-line:hover \.daily-flow-cm-fold-toggle\s*{[^}]*pointer-events:\s*auto/s);
  assert.match(styles, /--daily-flow-list-marker-size:\s*16px/);
  assert.match(styles, /--daily-flow-list-marker-center:\s*calc\(var\(--daily-flow-list-marker-size\) \/ 2\)/);
  assert.match(styles, /\.daily-flow-cm-list-line\.is-nested::before\s*{[^}]*top:\s*0[^}]*bottom:\s*0/s);
  assert.match(styles, /\.daily-flow-cm-list-line\.is-nested::before\s*{[^}]*width:\s*calc\(var\(--daily-flow-list-depth\) \* 1em\)/s);
  assert.match(styles, /\.daily-flow-cm-list-line\.is-nested::before\s*{[^}]*repeating-linear-gradient\([^}]*var\(--daily-flow-list-marker-center\)[^}]*var\(--daily-flow-line-strong\)/s);
  assert.match(styles, /\.daily-flow-cm-bullet\s*{[^}]*margin:\s*0 13\.5px 3px 5\.5px/s);
});

test("task list scroll position survives task detail rerenders", () => {
  assert.match(source, /this\.taskListScrollPositions = new Map\(\)/);
  assert.match(source, /this\.rememberTaskListScrollPosition\(\)/);
  assert.match(source, /listScroll\.dataset\.filter = this\.taskFilter/);
  assert.match(source, /const listScrollTop = this\.taskListScrollPositions\.get\(this\.taskFilter\) \|\| 0/);
  assert.match(source, /main\.appendChild\(board\);\s*listScroll\.scrollTop = listScrollTop/s);
  assert.match(source, /this\.taskListScrollPositions\.set\(filter, listScroll\.scrollTop\)/);
});

test("task groups are collapsible and persist their state", () => {
  assert.match(source, /renderTaskGroup\(container, key, title, tasks\)/);
  assert.match(source, /daily-flow-task-group-toggle/);
  assert.match(source, /collapsedTaskGroups/);
  assert.match(source, /core\.updateSettings\(this\.plugin\.data, \{\s*collapsedTaskGroups:/s);
  assert.match(styles, /\.daily-flow-task-group-toggle\s*\{/);
});

test("task rows match TickTick content and overdue indicators", () => {
  assert.match(source, /hasTaskChildContent\(task\)/);
  assert.match(source, /daily-flow-task-content-check/);
  assert.match(source, /taskOverdueDays\(task\)/);
  assert.match(source, /`过期 \$\{overdueDays\} 天`/);
  assert.match(source, /date\.addClass\("is-overdue"\)/);
  assert.match(styles, /\.daily-flow-task-content-check\s*\{/);
  assert.match(styles, /\.daily-flow-task-date\.is-overdue\s*\{[^}]*color:\s*#ef4444/s);
  assert.match(styles, /\.daily-flow-task-row\s*\{[^}]*align-items:\s*center/s);
});
