import { build } from "esbuild";

await build({
  entryPoints: ["src/obsidian-plugin.js"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "es2020",
  external: ["obsidian"],
  outfile: "main.js",
  banner: {
    js: "/* DailyFlow Obsidian plugin */"
  },
  footer: {
    js: "module.exports.default = module.exports;"
  }
});
