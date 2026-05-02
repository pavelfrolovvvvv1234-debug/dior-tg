/**
 * Prints unique emoji-like characters from locales/*.ftl for filling CUSTOM_EMOJI_ICON_MAP_JSON.
 * Run: npx tsx scripts/list-ftl-emoji-chars.ts
 */

import fs from "node:fs/promises";
import path from "node:path";

const emojiRe = /\p{Extended_Pictographic}/gu;

async function main(): Promise<void> {
  const localesDir = path.resolve("locales");
  const dirs = await fs.readdir(localesDir);
  const set = new Set<string>();
  for (const dir of dirs) {
    const ftl = path.join(localesDir, dir, "translation.ftl");
    try {
      const raw = await fs.readFile(ftl, "utf8");
      let m: RegExpExecArray | null;
      emojiRe.lastIndex = 0;
      while ((m = emojiRe.exec(raw)) !== null) {
        set.add(m[0]);
      }
    } catch {
      // skip
    }
  }
  const sorted = [...set].sort();
  console.log(JSON.stringify(Object.fromEntries(sorted.map((c) => [c, ""])), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
