# AGENTS.md

## 项目目标

DailyFlow 是一个面向 Obsidian 的本地任务、日历和番茄专注插件。

产品方向是：尽量做成接近滴答清单的样式、交互和功能体验。

## 滴答清单优先原则

- 在视觉设计、布局、交互流程和功能设计上，默认优先参考滴答清单。
- 如果用户给了滴答清单截图，应尽量按照截图里的结构、间距、颜色、层级、文案和交互状态实现。
- 除非用户明确说要在滴答清单基础上调整，否则不要主动改成明显不同的设计风格。
- 如果滴答清单某个功能、状态或交互只靠截图无法确定，先询问用户，不要自行猜测。
- 如果无法完全复刻，应说明限制，并给出最接近的实现方案。

## 当前工作方式

- 用户希望多个功能可以并行完善，避免不同会话互相污染上下文。
- 新会话开始时，应优先阅读 `docs/DAILYFLOW_HANDOFF.md`。
- 不同功能应在对应 worktree 中完成，不要在根目录直接继续做具体功能。
- 如果用户要复制到 Obsidian 查看多个功能合成后的效果，应使用 `scripts/refresh-preview.mjs --copy` 生成本地合成预览，不要直接从单个功能 worktree 复制。
- 合成预览只包含各功能分支已经本地提交的内容；如果某个功能 worktree 还有未提交修改，先提醒用户提交或暂存，不要默默混入。
- 在用户明确说“可以提交/发布”之前，不要推送 GitHub，不要创建 GitHub Release，不要打新 tag。

## 编码行为

- 修改前先简要说明目标、关键假设、可能修改的文件、验证方式。
- 保持最小改动，只改与当前功能直接相关的文件。
- 不做无关重构，不重新格式化无关代码。
- 已有功能能正常工作时，不为了“更优雅”而重写。
- 如果发现无关问题，可以单独指出，不要顺手修改。

## 验证要求

功能修改后，尽量运行：

```bash
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test src/*.test.js
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check src/obsidian-plugin.js
/Users/frank/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/build.mjs
```

如果需要让用户在 Obsidian 里试用，再把构建产物复制到：

```bash
/Users/frank/Library/CloudStorage/OneDrive-个人/5 others/ob/.obsidian/plugins/daily-flow/
```

需要复制的文件通常是：

```text
manifest.json
main.js
styles.css
```

## 发布要求

- 只有在用户明确要求发布时，才提交、打 tag、推送 GitHub、创建 Release。
- 发布前应更新版本号、`CHANGELOG.md`、`versions.json`，并准备 release notes。
- 发布前必须重新运行测试和打包。
