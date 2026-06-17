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
const releaseBranch = "feature/release-polish";
const previewBranch = "preview/local-obsidian";
const previewPath = resolve(root, ".worktrees/preview-local");
const obsidianPluginDir =
  "/Users/frank/Library/CloudStorage/OneDrive-个人/5 others/ob/.obsidian/plugins/daily-flow";

const featureBranches = [
  "feature/focus-page",
  "feature/calendar-views",
  "feature/task-detail-popover",
  "feature/mobile-layout",
];

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const copyToObsidian = args.has("--copy");
const releaseMode = args.has("--release");
const forceFullVerification = args.has("--full") || args.has("--verify");
const skipDirtyCheck = args.has("--skip-dirty-check");
const requestedBranch = readOption("--branch");
const requestedBranches = readOption("--branches");
const requestedBase = readOption("--base");

main();

function main() {
  const plan = getPreviewPlan();

  if (!skipDirtyCheck) {
    ensureBranchWorktreeIsCleanIfPresent(plan.baseRef);
    for (const branch of plan.branches) {
      ensureBranchWorktreeIsClean(branch);
    }
  }

  ensurePreviewWorktree(plan.baseRef);
  resetPreviewToBase(plan.baseRef);
  mergeFeatureBranches(plan.branches);
  if (plan.fullVerification) {
    verifyPreviewBuild();
  } else {
    buildPreviewOnly();
  }

  if (copyToObsidian) {
    copyBuildToObsidian();
  }

  console.log("\nPreview is ready.");
  console.log(`Mode: ${plan.mode}`);
  console.log(
    `Verification: ${plan.fullVerification ? "full tests" : "fast build only"}`,
  );
  console.log(`Base: ${plan.baseRef}`);
  console.log(`Branches: ${plan.branches.join(", ") || "(none)"}`);
  console.log(`Path: ${previewPath}`);
  if (copyToObsidian) {
    console.log(`Copied to: ${obsidianPluginDir}`);
  }
}

function getPreviewPlan() {
  const baseRef = requestedBase || releaseBranch;

  if (releaseMode) {
    return {
      mode: "release-polish full preview",
      baseRef,
      branches: readBranchesOrDefault(featureBranches),
      fullVerification: true,
    };
  }

  if (requestedBranch === releaseBranch) {
    return {
      mode: "release-polish full preview",
      baseRef,
      branches: readBranchesOrDefault(featureBranches),
      fullVerification: true,
    };
  }

  if (requestedBranch) {
    return {
      mode: "single feature preview",
      baseRef,
      branches: [requestedBranch],
      fullVerification: forceFullVerification,
    };
  }

  if (requestedBranches) {
    return {
      mode: "selected feature preview",
      baseRef,
      branches: readBranchesOrDefault([]),
      fullVerification: forceFullVerification,
    };
  }

  const currentBranch = getCurrentBranch(process.cwd());
  if (currentBranch === releaseBranch) {
    return {
      mode: "release-polish full preview",
      baseRef,
      branches: featureBranches,
      fullVerification: true,
    };
  }

  if (featureBranches.includes(currentBranch)) {
    return {
      mode: "single feature preview",
      baseRef,
      branches: [currentBranch],
      fullVerification: forceFullVerification,
    };
  }

  fail(
    [
      "Could not infer which preview to build.",
      "",
      "Use one of these:",
      "  node scripts/refresh-preview.mjs --branch=feature/focus-page --copy",
      "  node scripts/refresh-preview.mjs --release --copy",
    ].join("\n"),
  );
}

function readBranchesOrDefault(defaultValue) {
  if (!requestedBranches) return defaultValue;

  return requestedBranches
    .split(",")
    .map((branch) => branch.trim())
    .filter(Boolean);
}

function ensurePreviewWorktree(baseRef) {
  if (existsSync(previewPath)) return;

  mkdirSync(dirname(previewPath), { recursive: true });
  if (branchExists(previewBranch)) {
    run("git", ["worktree", "add", previewPath, previewBranch]);
  } else {
    run("git", ["worktree", "add", previewPath, "-b", previewBranch, baseRef]);
  }
}

function resetPreviewToBase(baseRef) {
  run("git", ["merge", "--abort"], previewPath, { allowFailure: true });
  run("git", ["reset", "--hard", baseRef], previewPath);
}

function mergeFeatureBranches(branches) {
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

function buildPreviewOnly() {
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

  ensureWorktreeIsClean(branch, worktreePath);
}

function ensureBranchWorktreeIsCleanIfPresent(ref) {
  const worktreePath = getWorktreePathForBranch(ref);
  if (!worktreePath) return;

  ensureWorktreeIsClean(ref, worktreePath);
}

function ensureWorktreeIsClean(branch, worktreePath) {
  const status = output("git", ["status", "--porcelain"], worktreePath);
  if (!status) return;

  fail(
    [
      `${branch} has uncommitted changes.`,
      `Worktree: ${worktreePath}`,
      "Ask Frank whether to commit, stash, or leave those changes before refreshing the preview.",
      "",
      status,
    ].join("\n"),
  );
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

function getCurrentBranch(cwd) {
  try {
    return output("git", ["branch", "--show-current"], cwd);
  } catch {
    return "";
  }
}

function branchExists(branch) {
  try {
    execFileSync("git", ["rev-parse", "--verify", `refs/heads/${branch}`], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function readOption(name) {
  const prefix = `${name}=`;
  const option = rawArgs.find((arg) => arg.startsWith(prefix));

  return option ? option.slice(prefix.length) : "";
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
