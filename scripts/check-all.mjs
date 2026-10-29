// Aggregates all check scripts (rivo-style `check` entry point).
// Usage: npm run check
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const checks = [
  "check-imports.mjs",
  "check-org-scope.mjs",
];

let failed = 0;
for (const check of checks) {
  console.log(`\n=== ${check} ===`);
  const result = spawnSync(process.execPath, [path.join(__dirname, check)], {
    stdio: "inherit",
  });
  if (result.status !== 0) failed++;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed ✗`);
  process.exit(1);
}
console.log("\nAll checks passed ✓");
