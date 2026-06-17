import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodePath = process.execPath;

const defaultBranches = [
  "feature/focus-page",
  "feature/calendar-views",
  "feature/task-detail-popover",
  "feature/mobile-layout",
];

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const dryRun = args.has("--dry-run");
const verify = args.has("--verify");
const allBranches = args.has("--all");
const skipDirtyCheck = args.has("--skip-dirty-check");
const requestedBase = readOption("--base") || "latest-tag";
const requestedBranch = readOption("--branch");
const requestedBranches = readOption("--branches");

main();

function main() {
  const branches = getSelectedBranches();
  const baseRef = resolveBaseRef(requestedBase);

  ensureRefExists(baseRef);
  ensureBranchesExist(branches);

  console.log(`Base: ${baseRef}`);
  console.log(`Branches: ${branches.join(", ")}`);
  if (dryRun) {
    console.log("Mode: dry-run");
  }

  for (const branch of branches) {
    syncBranch(branch, baseRef);
  }

  console.log("\nFeature base sync complete.");
}

function getSelectedBranches() {
  if (allBranches) return defaultBranches;

  if (requestedBranch) return [requestedBranch];

  if (requestedBranches) {
    return requestedBranches
      .split(",")
      .map((branch) => branch.trim())
      .filter(Boolean);
  }

  fail(
    [
      "Choose the feature branch to sync.",
      "",
      "Examples:",
      "  node scripts/sync-feature-base.mjs --branch=feature/focus-page",
      "  node scripts/sync-feature-base.mjs --all",
    ].join("\n"),
  );
}

function syncBranch(branch, baseRef) {
  const worktreePath = getWorktreePathForBranch(branch);
  if (!worktreePath) {
    fail(`No worktree was found for ${branch}.`);
  }

  if (!skipDirtyCheck) {
    ensureWorktreeIsClean(branch, worktreePath);
  }

  const baseAlreadyIncluded = isAncestor(baseRef, "HEAD", worktreePath);
  if (baseAlreadyIncluded) {
    console.log(`\n${branch} already contains ${baseRef}.`);
  } else if (dryRun) {
    console.log(`\nWould merge ${baseRef} into ${branch}.`);
  } else {
    console.log(`\nMerging ${baseRef} into ${branch}.`);
    run("git", ["merge", "--no-edit", baseRef], worktreePath);
  }

  if (verify && !dryRun) {
    verifyWorktree(worktreePath);
  } else if (verify && dryRun) {
    console.log(`Would verify ${branch} after syncing.`);
  }
}

function verifyWorktree(worktreePath) {
  const testFiles = readdirSync(join(worktreePath, "src"))
    .filter((file) => file.endsWith(".test.js"))
    .sort()
    .map((file) => `src/${file}`);

  if (!testFiles.length) {
    fail("No test files found under src.");
  }

  run(nodePath, ["--test", ...testFiles], worktreePath);
  run(nodePath, ["--check", "src/obsidian-plugin.js"], worktreePath);
  run(nodePath, ["scripts/build.mjs"], worktreePath);
}

function resolveBaseRef(baseRef) {
  if (baseRef !== "latest-tag") return baseRef;

  const tags = output("git", ["tag", "--list", "--sort=-version:refname"])
    .split("\n")
    .map((tag) => tag.trim())
    .filter((tag) => /^v?\d+\.\d+\.\d+$/.test(tag));

  if (!tags.length) {
    fail("No version tags were found. Pass --base=<branch-or-tag> explicitly.");
  }

  return tags[0];
}

function ensureRefExists(ref) {
  run("git", ["rev-parse", "--verify", `${ref}^{commit}`], root, {
    quiet: true,
  });
}

function ensureBranchesExist(branches) {
  for (const branch of branches) {
    run("git", ["rev-parse", "--verify", `refs/heads/${branch}`], root, {
      quiet: true,
    });
  }
}

function ensureWorktreeIsClean(branch, worktreePath) {
  const status = output("git", ["status", "--porcelain"], worktreePath);
  if (!status) return;

  fail(
    [
      `${branch} has uncommitted changes.`,
      `Worktree: ${worktreePath}`,
      "Commit or stash those changes before syncing the release base.",
      "",
      status,
    ].join("\n"),
  );
}

function isAncestor(ancestor, descendant, cwd) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
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

function readOption(name) {
  const prefix = `${name}=`;
  const option = rawArgs.find((arg) => arg.startsWith(prefix));

  return option ? option.slice(prefix.length) : "";
}

function run(command, commandArgs, cwd = root, options = {}) {
  if (!options.quiet) {
    console.log(`$ ${command} ${commandArgs.join(" ")}`);
  }

  try {
    execFileSync(command, commandArgs, {
      cwd,
      stdio: options.quiet ? "ignore" : "inherit",
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
