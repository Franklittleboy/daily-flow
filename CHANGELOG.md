# Changelog

## 0.1.2 - 2026-06-12

Fixed DailyFlow opening in Obsidian's right sidebar by default.

- The ribbon icon and command now open DailyFlow in the main workspace as a full tab.
- Added a regression test to keep the plugin from opening in the right sidebar again.

## 0.1.1 - 2026-06-12

Fixed the plugin bundle so Obsidian can load DailyFlow successfully.

- Removed a bundled variable shadowing issue that caused `Cannot access 'core' before initialization`.
- Added a smoke test that verifies the built `main.js` loads with an Obsidian API stub.
- Added both CommonJS and `default` exports for better compatibility with Obsidian's plugin loader.

## 0.1.0 - 2026-06-12

Initial DailyFlow MVP.

- Added Today, Next 7 Days, and Inbox task views.
- Added month and week calendar views.
- Added task creation, editing, completion, and deletion.
- Added focus timer with optional task binding.
- Added focus history and simple stats.
- Added settings for focus duration, week start day, completed task visibility, and JSON export.
- Added local Obsidian plugin release files: `manifest.json`, `main.js`, `styles.css`, and `versions.json`.
