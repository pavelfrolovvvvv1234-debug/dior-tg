/**
 * Fallback: replace require("@/...") in dist when fix-dist-aliases.cjs is missing.
 * Run from project root: node scripts/fix-dist-fallback.cjs
 */
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
if (!fs.existsSync(distDir)) {
  console.log("[fix-dist-fallback] dist/ not found");
  process.exit(1);
}

function fixFile(filePath) {
  let s = fs.readFileSync(filePath, "utf8");
  const dir = path.dirname(filePath);
  const r = s.replace(/require\s*\(\s*["']@\/([^"']+)["']\s*\)/g, (_, p) => {
    const target = path.join(distDir, p.replace(/\.js$/, "") + ".js");
    let rel = path.relative(dir, target).replace(/\\/g, "/").replace(/\.js$/, "");
    if (!rel.startsWith(".")) rel = "./" + rel;
    return 'require("' + rel + '")';
  });
  if (r !== s) {
    fs.writeFileSync(filePath, r, "utf8");
    return 1;
  }
  return 0;
}

function walk(dir, count) {
  fs.readdirSync(dir).forEach((n) => {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p, count);
    else if (n.endsWith(".js")) count[0] += fixFile(p);
  });
}

const count = [0];
walk(distDir, count);
console.log("[fix-dist-fallback] Replaced", count[0], "path alias(es) in dist");
process.exit(0);
