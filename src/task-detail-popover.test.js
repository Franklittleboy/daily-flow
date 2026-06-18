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
  assert.match(styles, /\.daily-flow-cm-folded-line\s*{[^}]*display:\s*none/s);
});
