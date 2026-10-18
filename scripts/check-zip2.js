const { execSync } = require("child_process");
const fs = require("fs");
const Database = require("better-sqlite3");

const zipPath = "C:/Users/Lenovo/Desktop/Floreria_Farfalina_Sistema_Local_Completo (2).zip";
const outDir = "C:/Users/Lenovo/Desktop/floreria/scripts/temp_zip2";

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

console.log("Extracting dev.db from zip (2)...");
try {
  execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath}'); $entry = $zip.Entries | Where-Object { $_.FullName -like '*prisma/dev.db*' } | Select-Object -First 1; if ($entry) { [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, '${outDir}/dev.db', $true); Write-Host 'Extracted dev.db' } else { Write-Host 'No dev.db found' }"`);

  const dbFile = `${outDir}/dev.db`;
  if (fs.existsSync(dbFile)) {
    const stat = fs.statSync(dbFile);
    console.log(`Extracted DB size: ${stat.size} bytes`);
    const db = new Database(dbFile, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(t => t.name);
    for (const t of tables) {
      if (t.startsWith("sqlite_")) continue;
      const count = db.prepare(`SELECT count(*) as c FROM "${t}"`).get().c;
      if (count > 0) {
        console.log(`- ${t}: ${count} rows`);
      }
    }
  }
} catch (e) {
  console.error("Error:", e.message);
}
