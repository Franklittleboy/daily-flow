import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodePath = process.execPath;
const baseBranch = "draft/0.1.10-base";
const previewBranch = "preview/local-obsidian";
const previewPath = resolve(root, ".worktrees/preview-local");
const obsidianPluginDir =
  "/Users/frank/Library/CloudStorage/OneDrive-个人/5 others/ob/.obsidian/plugins/daily-flow";

const defaultBranches = [
  "feature/focus-page",
  "feature/calendar-views",
  "feature/task-detail-popover",
  "feature/mobile-layout",
];

const args = new Set(process.argv.slice(2));
const copyToObsidian = args.has("--copy");
const skipDirtyCheck = args.has("--skip-dirty-check");
const requestedBranches = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--branches="));
const branches = requestedBranches
  ? requestedBranches
      .slice("--branches=".length)
      .split(",")
      .map((branch) => branch.trim())
      .filter(Boolean)
  : defaultBranches;

main();

function main() {
  if (!branches.length) {
    fail("No feature branches were selected.");
  }

  if (!skipDirtyCheck) {
    for (const branch of branches) {
      ensureBranchWorktreeIsClean(branch);
    }
  }

  ensurePreviewWorktree();
  resetPreviewToBase();
  mergeFeatureBranches();
  verifyPreviewBuild();

  if (copyToObsidian) {
    copyBuildToObsidian();
  }

  console.log("\nPreview is ready.");
  console.log(`Path: ${previewPath}`);
  if (copyToObsidian) {
    console.log(`Copied to: ${obsidianPluginDir}`);
  }
}

function ensurePreviewWorktree() {
  if (existsSync(previewPath)) return;

  mkdirSync(dirname(previewPath), { recursive: true });
  run("git", ["worktree", "add", previewPath, "-b", previewBranch, baseBranch]);
}

function resetPreviewToBase() {
  run("git", ["merge", "--abort"], previewPath, { allowFailure: true });
  run("git", ["reset", "--hard", baseBranch], previewPath);
}

function mergeFeatureBranches() {
  for (const branch of branches) {
    run("git", ["merge", "--no-edit", branch], previewPath);
  }
}

function verifyPreviewBuild() {
  const testFiles = readdirSync(join(previewPath, "src"))
    .filter((file) => file.endsWith(".test.js"))
    .sort()
    .map((file) => `src/${file}`);

  if (!testFiles.length) {
    fail("No test files found under src.");
  }

  run(nodePath, ["--test", ...testFiles], previewPath);
  run(nodePath, ["--check", "src/obsidian-plugin.js"], previewPath);
  run(nodePath, ["scripts/build.mjs"], previewPath);
}

function copyBuildToObsidian() {
  mkdirSync(obsidianPluginDir, { recursive: true });

  for (const file of ["manifest.json", "main.js", "styles.css"]) {
    copyFileSync(join(previewPath, file), join(obsidianPluginDir, file));
  }
}

function ensureBranchWorktreeIsClean(branch) {
  const worktreePath = getWorktreePathForBranch(branch);
  if (!worktreePath) {
    fail(`No worktree was found for ${branch}.`);
  }

  const status = output("git", ["status", "--porcelain"], worktreePath);
  if (status) {
    fail(
      [
        `${branch} has uncommitted changes.`,
        `Worktree: ${worktreePath}`,
        "Commit or stash those changes locally before refreshing the combined preview.",
        "",
        status,
      ].join("\n"),
    );
  }
}

function getWorktreePathForBranch(branch) {
  const lines = output("git", ["worktree", "list", "--porcelain"]).split("\n");
  let currentPath = null;

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length);
    } else if (line === `branch refs/heads/${branch}`) {
      return currentPath;
    }
  }

  return null;
}

function run(command, commandArgs, cwd = root, options = {}) {
  console.log(`$ ${command} ${commandArgs.join(" ")}`);

  try {
    execFileSync(command, commandArgs, {
      cwd,
      stdio: "inherit",
    });
  } catch (error) {
    if (options.allowFailure) return;
    throw error;
  }
}

function output(command, commandArgs, cwd = root) {
  return execFileSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
  }).trim();
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}
