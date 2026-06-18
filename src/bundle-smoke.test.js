const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");

test("built plugin bundle loads with an Obsidian API stub", () => {
  const mainPath = path.resolve(__dirname, "../main.js");
  delete require.cache[mainPath];

  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === "obsidian") {
      return {
        Plugin: class {},
        ItemView: class {},
        Modal: class {},
        PluginSettingTab: class {},
        Setting: class {
          setName() { return this; }
          setDesc() { return this; }
          addText() { return this; }
          addTextArea() { return this; }
          addDropdown() { return this; }
          addToggle() { return this; }
          addButton() { return this; }
        }
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const pluginExport = require(mainPath);
    assert.equal(typeof pluginExport, "function");
    assert.equal(typeof pluginExport.default, "function");
  } finally {
    Module._load = originalLoad;
    delete require.cache[mainPath];
  }
});
