import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractTestNames,
  findMissingContracts,
  findOverlappingFiles,
  findUnsyncedBranches,
  formatMissingContracts,
  formatOverlapReport,
} from "./preview-guard.mjs";

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
const featureContracts = new Map([
  ["feature/focus-page", "src/focus-page.test.js"],
  ["feature/calendar-views", "src/calendar-views.test.js"],
  ["feature/task-detail-popover", "src/task-detail-popover.test.js"],
  ["feature/mobile-layout", "src/mobile-layout.test.js"],
]);

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

  const releaseGuard = plan.releaseGuard
    ? prepareReleaseGuard(plan)
    : null;

  ensurePreviewWorktree(plan.baseRef);
  resetPreviewToBase(plan.baseRef);
  mergeFeatureBranches(plan.branches);
  if (releaseGuard) {
    verifyReleaseContracts(releaseGuard.contractsByBranch);
    console.log(`\n${formatOverlapReport(releaseGuard.overlaps)}`);
  }
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
      releaseGuard: true,
    };
  }

  if (requestedBranch === releaseBranch) {
    return {
      mode: "release-polish full preview",
      baseRef,
      branches: readBranchesOrDefault(featureBranches),
      fullVerification: true,
      releaseGuard: true,
    };
  }

  if (requestedBranch) {
    return {
      mode: "single feature preview",
      baseRef,
      branches: [requestedBranch],
      fullVerification: forceFullVerification,
      releaseGuard: false,
    };
  }

  if (requestedBranches) {
    return {
      mode: "selected feature preview",
      baseRef,
      branches: readBranchesOrDefault([]),
      fullVerification: forceFullVerification,
      releaseGuard: false,
    };
  }

  const currentBranch = getCurrentBranch(process.cwd());
  if (currentBranch === releaseBranch) {
    return {
      mode: "release-polish full preview",
      baseRef,
      branches: featureBranches,
      fullVerification: true,
      releaseGuard: true,
    };
  }

  if (featureBranches.includes(currentBranch)) {
    return {
      mode: "single feature preview",
      baseRef,
      branches: [currentBranch],
      fullVerification: forceFullVerification,
      releaseGuard: false,
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

function prepareReleaseGuard(plan) {
  const latestTag = getLatestVersionTag();
  const unsynced = findUnsyncedBranches(
    plan.branches,
    (branch) => isAncestor(latestTag, branch),
  );
  if (unsynced.length) {
    fail([
      `Release preview requires every feature branch to contain ${latestTag}.`,
      ...unsynced.flatMap((branch) => [
        "",
        `${branch} is not synchronized.`,
        `${nodePath} scripts/sync-feature-base.mjs --branch=${branch} --verify`,
      ]),
    ].join("\n"));
  }

  const contractsByBranch = new Map();
  const filesByBranch = new Map();
  console.log("\nRelease preview inputs:");
  console.log(`Latest tag: ${latestTag} @ ${shortRef(latestTag)}`);
  console.log(`Base: ${plan.baseRef} @ ${shortRef(plan.baseRef)}`);

  for (const branch of plan.branches) {
    const contractFile = featureContracts.get(branch);
    if (!contractFile) {
      fail(`No feature contract file is configured for ${branch}.`);
    }
    const contractSource = readRefFile(branch, contractFile);
    const testNames = extractTestNames(contractSource);
    if (!testNames.length) {
      fail(`${branch} has no named tests in ${contractFile}.`);
    }
    contractsByBranch.set(branch, testNames);
    filesByBranch.set(branch, changedFiles(latestTag, branch));
    console.log(`${branch} @ ${shortRef(branch)} (${testNames.length} contracts)`);
  }

  return {
    contractsByBranch,
    overlaps: findOverlappingFiles(filesByBranch),
  };
}

function verifyReleaseContracts(contractsByBranch) {
  const mergedNames = new Set();
  for (const file of readdirSync(join(previewPath, "src"))) {
    if (!file.endsWith(".test.js")) continue;
    const source = readFileSync(join(previewPath, "src", file), "utf8");
    for (const testName of extractTestNames(source)) {
      mergedNames.add(testName);
    }
  }

  const missing = findMissingContracts(contractsByBranch, mergedNames);
  if (missing.length) {
    fail(formatMissingContracts(missing));
  }
  const contractCount = [...contractsByBranch.values()]
    .reduce((sum, names) => sum + names.length, 0);
  console.log(`\nFeature contracts verified: ${contractCount}`);
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

function getLatestVersionTag() {
  const tags = output("git", ["tag", "--list", "--sort=-version:refname"])
    .split("\n")
    .map((tag) => tag.trim())
    .filter((tag) => /^v?\d+\.\d+\.\d+$/.test(tag));
  if (!tags.length) {
    fail("No version tags were found for release preview validation.");
  }
  return tags[0];
}

function isAncestor(ancestor, descendant) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function shortRef(ref) {
  return output("git", ["rev-parse", "--short", ref]);
}

function readRefFile(ref, file) {
  try {
    return output("git", ["show", `${ref}:${file}`]);
  } catch {
    fail(`${ref} is missing its feature contract file: ${file}`);
  }
}

function changedFiles(baseRef, branch) {
  const changed = output("git", ["diff", "--name-only", `${baseRef}..${branch}`]);
  return changed ? changed.split("\n").filter(Boolean) : [];
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
