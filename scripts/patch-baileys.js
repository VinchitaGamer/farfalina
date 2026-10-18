const fs = require("fs");
const path = require("path");

function patchBaileysRustBridge() {
  const pkgPath = path.join(
    process.cwd(),
    "node_modules",
    "whatsapp-rust-bridge",
    "package.json"
  );

  if (!fs.existsSync(pkgPath)) {
    return;
  }

  try {
    const raw = fs.readFileSync(pkgPath, "utf8");
    const json = JSON.parse(raw);

    let modified = false;

    if (!json.main) {
      json.main = "./dist/index.js";
      modified = true;
    }

    if (json.exports && json.exports["."]) {
      if (!json.exports["."].require) {
        json.exports["."].require = "./dist/index.js";
        modified = true;
      }
      if (!json.exports["."].default) {
        json.exports["."].default = "./dist/index.js";
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(pkgPath, JSON.stringify(json, null, 4), "utf8");
      console.log("[Patch] whatsapp-rust-bridge package.json patched with require/default exports.");
    }
  } catch (err) {
    console.warn("[Patch] Could not patch whatsapp-rust-bridge:", err.message);
  }
}

patchBaileysRustBridge();
