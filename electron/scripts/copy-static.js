/**
 * Copy frontend/build into electron/resources/static so the packaged app
 * (Store/installer) serves the same latest UI as "npm run start".
 * Run from electron folder: node scripts/copy-static.js
 */
const fs = require("fs");
const path = require("path");

const electronRoot = path.join(__dirname, "..");
const src = path.join(electronRoot, "..", "frontend", "build");
const dest = path.join(electronRoot, "resources", "static");

if (!fs.existsSync(src)) {
  console.error("Frontend build not found. Run in frontend folder: npm run build");
  process.exit(1);
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log("Copied frontend/build -> electron/resources/static");
console.log("Package (npm run dist) will now bundle this UI.");
