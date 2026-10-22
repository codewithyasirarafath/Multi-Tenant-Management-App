// One-time refactor script: moves all modules into feature-based src/ structure
// and rewrites every relative import path to match the new locations.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// old path (repo-relative) -> new path (repo-relative)
const MAP = {
  // routes
  "routes/authroutes.js": "src/auth/routes.js",
  "routes/organizationroutes.js": "src/organizations/routes.js",
  "routes/entityroutes.js": "src/entities/routes.js",
  "routes/userroutes.js": "src/users/routes.js",
  "routes/roleroutes.js": "src/roles/routes.js",
  "routes/userroleroutes.js": "src/memberships/routes.js",
  "routes/permissionroutes.js": "src/permissions/routes.js",
  "routes/deliveryroutes.js": "src/deliveries/routes.js",
  "routes/inventoryroutes.js": "src/inventory/routes.js",
  "routes/customerroutes.js": "src/customers/routes.js",
  "routes/invoicingroutes.js": "src/invoicing/routes.js",
  "routes/notificationroutes.js": "src/notifications/routes.js",
  "routes/webhookroutes.js": "src/webhooks/routes.js",
  "routes/apikeyroutes.js": "src/api-keys/routes.js",
  "routes/aichatroutes.js": "src/ai-chat/routes.js",
  // controllers
  "controllers/authcontroller.js": "src/auth/controller.js",
  "controllers/organizationcontroller.js": "src/organizations/controller.js",
  "controllers/entitycontroller.js": "src/entities/controller.js",
  "controllers/usercontroller.js": "src/users/controller.js",
  "controllers/rolecontroller.js": "src/roles/controller.js",
  "controllers/userrolecontroller.js": "src/memberships/controller.js",
  "controllers/permissioncontroller.js": "src/permissions/controller.js",
  "controllers/deliverycontroller.js": "src/deliveries/controller.js",
  "controllers/inventorycontroller.js": "src/inventory/controller.js",
  "controllers/customercontroller.js": "src/customers/controller.js",
  "controllers/invoicingcontroller.js": "src/invoicing/controller.js",
  "controllers/notificationcontroller.js": "src/notifications/controller.js",
  "controllers/webhookcontroller.js": "src/webhooks/controller.js",
  "controllers/aicontroller.js": "src/ai-chat/controller.js",
  // models
  "models/authmodel.js": "src/auth/model.js",
  "models/organizationmodel.js": "src/organizations/model.js",
  "models/entitymodel.js": "src/entities/model.js",
  "models/usermodel.js": "src/users/model.js",
  "models/rolemodel.js": "src/roles/model.js",
  "models/usermembershipmodel.js": "src/memberships/model.js",
  "models/userrolemodel.js": "src/memberships/userRoles.model.js",
  "models/permissionmodel.js": "src/permissions/model.js",
  "models/deliverymodel.js": "src/deliveries/model.js",
  "models/inventorymodel.js": "src/inventory/model.js",
  "models/customermodel.js": "src/customers/model.js",
  "models/invoicingmodel.js": "src/invoicing/model.js",
  "models/notificationmodel.js": "src/notifications/model.js",
  "models/webhookmodel.js": "src/webhooks/model.js",
  "models/apikeymodel.js": "src/api-keys/model.js",
  "models/aiconversationmodel.js": "src/ai-chat/model.js",
  "models/auditmodel.js": "src/audit/model.js",
  // middleware (shared + audit feature)
  "middleware/auth.js": "src/shared/middleware/auth.js",
  "middleware/errorhandler.js": "src/shared/middleware/errorHandler.js",
  "middleware/logger.js": "src/shared/middleware/logger.js",
  "middleware/ratelimit.js": "src/shared/middleware/rateLimit.js",
  "middleware/validation.js": "src/shared/middleware/validation.js",
  "middleware/index.js": "src/shared/middleware/index.js",
  "middleware/audit.js": "src/audit/middleware.js",
  // config (shared)
  "config/db.js": "src/shared/config/db.js",
  "config/swagger.js": "src/shared/config/swagger.js",
  // utils (shared)
  "utils/errors.js": "src/shared/utils/errors.js",
  "utils/sanitize.js": "src/shared/utils/sanitize.js",
  // services (ai-chat feature)
  "services/aichatservice.js": "src/ai-chat/service.js",
  "services/aiqueryservice.js": "src/ai-chat/query-service.js",
};

// main.js stays at repo root but its imports are rewritten with the same map
const MAIN_JS = { old: "main.js", stays: true };

const posix = path.posix;

function toPosix(p) {
  return p.replace(/\\/g, "/");
}

function rewriteSpecifier(spec, fromOldDir, newDir) {
  if (!spec.startsWith("./") && !spec.startsWith("../")) return null;
  const resolvedOld = posix.normalize(posix.join(fromOldDir, spec));
  const target = MAP[resolvedOld.toLowerCase()];
  if (!target) return null;
  let rel = posix.relative(newDir, target);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function rewriteImports(content, oldFile, newFile) {
  const oldDir = posix.dirname(toPosix(oldFile));
  const newDir = posix.dirname(toPosix(newFile));

  // static: import ... from "..." / export ... from "..."
  let out = content.replace(
    /(from\s+)(['"])(\.\.?\/[^'"]+)\2/g,
    (m, prefix, quote, spec) => {
      const rewritten = rewriteSpecifier(spec, oldDir, newDir);
      return rewritten === null ? m : `${prefix}${quote}${rewritten}${quote}`;
    }
  );

  // dynamic: import("...")
  out = out.replace(
    /(import\(\s*)(['"])(\.\.?\/[^'"]+)\2/g,
    (m, prefix, quote, spec) => {
      const rewritten = rewriteSpecifier(spec, oldDir, newDir);
      return rewritten === null ? m : `${prefix}${quote}${rewritten}${quote}`;
    }
  );

  return out;
}

let moved = 0;
let skipped = [];

for (const [oldRel, newRel] of Object.entries(MAP)) {
  const oldAbs = path.join(ROOT, toPosix(oldRel));
  const newAbs = path.join(ROOT, toPosix(newRel));

  if (!fs.existsSync(oldAbs)) {
    skipped.push(oldRel);
    continue;
  }

  fs.mkdirSync(path.dirname(newAbs), { recursive: true });

  let content = fs.readFileSync(oldAbs, "utf8");
  content = rewriteImports(content, toPosix(oldRel), toPosix(newRel));

  // special case: swagger glob paths point at old folders
  if (oldRel.toLowerCase() === "config/swagger.js") {
    content = content.replace(
      /apis:\s*\[\s*["']\.\/routes\/\*\.js["']\s*,\s*["']\.\/controllers\/\*\.js["']\s*\]/,
      'apis: ["./src/**/*.js"]'
    );
  }

  fs.writeFileSync(newAbs, content, "utf8");
  moved++;
}

// rewrite main.js in place (it resolves ./x/y.js against repo root)
const mainAbs = path.join(ROOT, "main.js");
if (fs.existsSync(mainAbs)) {
  let content = fs.readFileSync(mainAbs, "utf8");
  const oldDir = "";
  const newDir = "";
  content = content.replace(
    /(from\s+)(['"])(\.\.?\/[^'"]+)\2/g,
    (m, prefix, quote, spec) => {
      const resolvedOld = posix.normalize(posix.join(oldDir, spec));
      const target = MAP[resolvedOld.toLowerCase()];
      if (!target) return m;
      let rel = posix.relative(newDir, target);
      if (!rel.startsWith(".")) rel = "./" + rel;
      return `${prefix}${quote}${rel}${quote}`;
    }
  );
  fs.writeFileSync(mainAbs, content, "utf8");
  console.log("main.js imports rewritten");
}

console.log(`Moved ${moved} files${skipped.length ? `, skipped ${skipped.length}: ${skipped.join(", ")}` : ""}`);
