import { readFileSync, writeFileSync } from "node:fs";

const coreSource = readFileSync("src/core.js", "utf8");
const pluginSource = readFileSync("src/obsidian-plugin.js", "utf8");

const bundle = `/* DailyFlow Obsidian plugin */
const obsidian = require("obsidian");

const dailyFlowCore = (() => {
  const module = { exports: {} };
  const exports = module.exports;
${indent(coreSource)}
  return module.exports;
})();

const pluginModule = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  const require = (id) => {
    if (id === "obsidian") return obsidian;
    if (id === "./core") return dailyFlowCore;
    throw new Error("Unsupported bundled require: " + id);
  };
${indent(pluginSource)}
  return module.exports;
})();

module.exports = pluginModule;
module.exports.default = pluginModule;
`;

writeFileSync("main.js", bundle);

function indent(source) {
  return source
    .split("\n")
    .map((line) => (line ? `  ${line}` : ""))
    .join("\n");
}
