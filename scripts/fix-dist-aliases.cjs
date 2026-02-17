/**
 * Replaces require("@/...") with relative require() in dist/*.js so Node can
 * resolve modules without path aliases. Run after tsc so VPS/CI always get working dist.
 */
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
if (!fs.existsSync(distDir)) {
  console.log("[fix-dist-aliases] dist/ not found, skipping");
  process.exit(0);
}

function walk(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, callback);
    else if (e.isFile() && e.name.endsWith(".js")) callback(full);
  }
}

function fixRequireAlias(content, fileDir) {
  return content.replace(/require\s*\(\s*["']@\/([^"']+)["']\s*\)/g, (_, p) => {
    const target = path.join(distDir, p.replace(/\.js$/, "") + ".js");
    let rel = path.relative(fileDir, target);
    if (!rel.startsWith(".")) rel = "./" + rel;
    rel = rel.replace(/\\/g, "/").replace(/\.js$/, "");
    return "require(\"" + rel + "\")";
  });
}

let count = 0;
const indexPath = path.join(distDir, "index.js");
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, "utf8");
  const next = fixRequireAlias(indexContent, distDir);
  if (next !== indexContent) {
    fs.writeFileSync(indexPath, next, "utf8");
    count++;
  }
  // Final safety: literal replace so @/database is always ./database
  indexContent = fs.readFileSync(indexPath, "utf8");
  const safe = indexContent
    .replace(/require\s*\(\s*["']@\/database["']\s*\)/g, "require(\"./database\")")
    .replace(/require\s*\(\s*"@\/database"\s*\)/g, "require(\"./database\")")
    .replace(/require\s*\(\s*'@\/database'\s*\)/g, "require(\"./database\")");
  if (safe !== indexContent) {
    fs.writeFileSync(indexPath, safe, "utf8");
    count++;
  }
}

walk(distDir, (file) => {
  const content = fs.readFileSync(file, "utf8");
  const fileDir = path.dirname(file);
  const next = fixRequireAlias(content, fileDir);
  if (next !== content) {
    fs.writeFileSync(file, next, "utf8");
    count++;
  }
});

console.log("[fix-dist-aliases] Replaced", count, "path alias(es) in dist");
