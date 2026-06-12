# DailyFlow

DailyFlow is a local-first Obsidian plugin for tasks, calendar planning, and focus sessions. It is inspired by the daily planning flow of task apps while keeping data inside the plugin's local Obsidian data store.

## First Release Features

- Today, Next 7 Days, and Inbox task lists.
- Month and week calendar views.
- Create, edit, complete, and delete tasks.
- Pomodoro-style focus timer with optional task binding.
- Focus history and simple stats.
- Settings for default focus length, week start day, completed task visibility, and JSON export.

## Local Development

DailyFlow currently has no runtime or build dependencies. If `npm` is available, the package scripts work:

```bash
npm test
npm run build
```

If `npm` is not available, run the same checks directly with Node:

```bash
node --test src/*.test.js
node scripts/build.mjs
```

Check syntax without running Obsidian:

```bash
node --check src/core.js
node --check src/obsidian-plugin.js
node --check main.js
```

Manual installation for testing:

1. Build the plugin.
2. Copy `manifest.json`, `main.js`, and `styles.css` into `<vault>/.obsidian/plugins/daily-flow/`.
3. Enable DailyFlow from Obsidian community plugin settings.

## Release Notes

For a GitHub release, attach:

- `manifest.json`
- `main.js`
- `styles.css`

The release tag must match the `version` field in `manifest.json`.
