const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const zips = [
  "C:/Users/Lenovo/Desktop/Floreria_Farfalina_Sistema_Local_Completo.zip",
  "C:/Users/Lenovo/Desktop/Floreria_Farfalina_Sistema_Local_Completo (2).zip",
  "C:/Users/Lenovo/Desktop/Floreria_Farfalina_Sistema_Local.zip"
];

for (const z of zips) {
  if (!fs.existsSync(z)) continue;
  console.log("\n==========================================");
  console.log("EXAMINING ZIP:", z);
  try {
    // List files in zip with tar or powershell
    const cmd = `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${z}').Entries | Where-Object { $_.FullName -like '*dev.db*' -or $_.FullName -like '*.sql*' -or $_.FullName -like '*backup*' } | Select-Object FullName, Length, LastWriteTime"`;
    const out = execSync(cmd, { encoding: "utf8" });
    console.log(out || "No db/sql files in this zip.");
  } catch (err) {
    console.error("Error inspecting zip:", err.message);
  }
}
