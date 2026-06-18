export function extractTestNames(source) {
  const names = [];
  const pattern = /\btest\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)\s*,/g;
  let match = pattern.exec(source);
  while (match) {
    names.push(match[1] || match[2] || match[3]);
    match = pattern.exec(source);
  }
  return names;
}

export function findMissingContracts(contractsByBranch, mergedNames) {
  const missing = [];
  for (const [branch, names] of contractsByBranch) {
    for (const testName of names) {
      if (!mergedNames.has(testName)) {
        missing.push({ branch, testName });
      }
    }
  }
  return missing;
}

export function findUnsyncedBranches(branches, containsBase) {
  return branches.filter((branch) => !containsBase(branch));
}

export function findOverlappingFiles(filesByBranch) {
  const owners = new Map();
  for (const [branch, files] of filesByBranch) {
    for (const file of files) {
      if (!isProductionFile(file)) continue;
      owners.set(file, [...(owners.get(file) || []), branch]);
    }
  }

  return [...owners]
    .filter(([, branches]) => branches.length > 1)
    .map(([file, branches]) => ({ file, branches }))
    .sort((left, right) => left.file.localeCompare(right.file));
}

export function formatMissingContracts(missing) {
  const byBranch = new Map();
  for (const item of missing) {
    byBranch.set(item.branch, [...(byBranch.get(item.branch) || []), item.testName]);
  }

  const lines = ["Integration contracts are missing:"];
  for (const [branch, testNames] of byBranch) {
    lines.push(branch);
    for (const testName of testNames) {
      lines.push(`  - ${testName}`);
    }
  }
  return lines.join("\n");
}

export function formatOverlapReport(overlaps) {
  if (!overlaps.length) {
    return "Shared production files: none";
  }

  const lines = ["Shared production files:"];
  for (const overlap of overlaps) {
    lines.push(overlap.file);
    for (const branch of overlap.branches) {
      lines.push(`  - ${branch}`);
    }
  }
  return lines.join("\n");
}

function isProductionFile(file) {
  return file === "styles.css"
    || file === "main.js"
    || (file.startsWith("src/") && !file.endsWith(".test.js"));
}
