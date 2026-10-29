// Ensures bruno/environments/Local.bru exists (copied from the example).
// Local.bru holds runtime state (tokens, captured ids) written back by the
// Bruno CLI after each run, so it is gitignored — fresh clones copy the
// example automatically here.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.resolve(__dirname, "..", "bruno", "environments");
const local = path.join(envDir, "Local.bru");
const example = path.join(envDir, "Local.example.bru");

if (!fs.existsSync(local)) {
  fs.copyFileSync(example, local);
  console.log("Created bruno/environments/Local.bru from example.");
}
