// Cross-check: verifies every relative import in every JS file resolves to an existing file.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) files.push(full);
  }
}
walk(path.join(ROOT, "src"));
files.push(path.join(ROOT, "main.js"));

let broken = 0;
let total = 0;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);
  const specs = [...content.matchAll(/(?:from\s+|import\s*\(?\s*)(['"])(\.\.?\/[^'"]+)\1/g)].map((m) => m[2]);
  for (const spec of specs) {
    total++;
    const target = path.resolve(dir, spec);
    if (!fs.existsSync(target)) {
      broken++;
      console.log(`BROKEN: ${path.relative(ROOT, file)} -> ${spec}`);
    }
  }
}

console.log(`\nChecked ${files.length} files, ${total} relative imports.`);
console.log(broken === 0 ? "ALL IMPORTS RESOLVE ✓" : `${broken} broken imports ✗`);
process.exit(broken > 0 ? 1 : 0);
