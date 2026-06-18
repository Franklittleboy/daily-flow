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
- 发布后如果用户要让某个功能分支以最新发布版本为基础继续构建，应使用 `scripts/sync-feature-base.mjs`，默认以最新版本 tag 为基线，只融合“发布基线 + 当前功能分支自己的修改”。
- 如果用户在普通功能分支要求“复制到 Obsidian 看效果”或“复制到 Obsidian 看整体效果”，默认走最轻量预览：只在当前功能 worktree 执行 `scripts/build.mjs`，然后复制 `manifest.json`、`main.js`、`styles.css` 到 Obsidian 插件目录；不要合并 `feature/release-polish`，不要跑完整测试。
- 如果用户明确说“集成预览”“和 release-polish 合起来看”或“完整验证”，普通功能分支才使用 `scripts/refresh-preview.mjs --branch=<当前功能分支> --copy`；如需完整测试再加 `--full`。
- 如果用户在 `release-polish` 要求“复制到 Obsidian 看整体效果”或准备发布，应使用 `scripts/refresh-preview.mjs --release --copy`，合成 `feature/release-polish` 和全部普通功能分支，并完整运行测试、语法检查、打包。
- 预览只包含已提交内容；如果任何被纳入预览的 worktree 还有未提交修改，先询问用户要提交、暂存还是暂不纳入，不要默默混入。
- 在用户明确说“可以提交/发布”之前，不要推送 GitHub，不要创建 GitHub Release，不要打新 tag。

## 多会话集成契约

- 普通功能分支分别维护自己的验收测试：`focus-page.test.js`、`calendar-views.test.js`、`task-detail-popover.test.js`、`mobile-layout.test.js`。
- `release-polish` 维护 `release-integration.test.js`，用于保护跨功能组合后的最终行为。
- 普通功能会话不要合并兄弟功能分支，也不要用整文件覆盖方式决定其他功能的取舍；跨功能修改应在交接中明确标记。
- 功能交付时记录四项：分支、最新提交、专属测试文件、修改过的共享生产文件。
- 发布后、下一轮功能开发前，使用 `scripts/sync-feature-base.mjs --all --verify` 将所有普通功能分支同步到最新发布 tag。
- 完整 release 预览必须验证各分支专属测试仍在，并报告多个分支共同修改的生产文件。缺少契约、分支落后发布基线或 worktree 不干净时，不得复制到 Obsidian。
- 要推送最终集成版本时，先把已验证的 `preview/local-obsidian` 结果纳入 `feature/release-polish`，在该分支重新验证，再推送；不要直接推送临时预览分支。

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
