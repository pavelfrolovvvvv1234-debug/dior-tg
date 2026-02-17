/**
 * After tsc, rewrite dist/helpers/prices.js to dist/helpers/prices.cjs
 * so Node always loads it as CommonJS (avoids "exports is not defined" when package is ESM).
 * Run from project root: node fix-prices-cjs.cjs
 */
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "dist");
const pricesJs = path.join(distDir, "helpers", "prices.js");
const pricesCjs = path.join(distDir, "helpers", "prices.cjs");

if (!fs.existsSync(pricesJs)) {
  console.warn("fix-prices-cjs: dist/helpers/prices.js not found, skipping");
  process.exit(0);
}

let code = fs.readFileSync(pricesJs, "utf-8");
code = code
  // Remove exports.__esModule
  .replace(/Object\.defineProperty\(exports,\s*["']__esModule["'],\s*\{\s*value:\s*true\s*\}\);?\s*\n?/g, "")
  // Replace exports.default with module.exports
  .replace(/exports\.default\s*=/g, "module.exports =")
  // Remove __dirname declaration (it's auto-available in CommonJS)
  .replace(/const\s+__dirname\s*=\s*\(0,\s*[^)]+\)\.dirname\(\(0,\s*[^)]+\)\.fileURLToPath\(import\.meta\.url\)\);?\s*\n?/g, "")
  // Remove import.meta.url usage if any remains
  .replace(/import\.meta\.url/g, "undefined")
  // Remove unused node_url import if present
  .replace(/const\s+node_url_1\s*=\s*require\(["']node:url["']\);?\s*\n?/g, "");
fs.writeFileSync(pricesCjs, code, "utf-8");
fs.unlinkSync(pricesJs);
console.log("fix-prices-cjs: wrote dist/helpers/prices.cjs, removed prices.js");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".js")) {
      let content = fs.readFileSync(full, "utf-8");
      const before = content;
      content = content
        .replace(/require\s*\(\s*(["'])([^"']*helpers\/prices)(\.js)?\1\s*\)/g, (_, q, p) => `require(${q}${p}.cjs${q})`)
        .replace(/require\s*\(\s*(["'])\.\/prices(\.js)?\1\s*\)/g, (_, q) => `require(${q}./prices.cjs${q})`);
      if (content !== before) {
        fs.writeFileSync(full, content, "utf-8");
        console.log("fix-prices-cjs: patched", path.relative(distDir, full));
      }
    }
  }
}
walk(distDir);
