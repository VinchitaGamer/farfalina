const fs = require('fs');
const path = require('path');

function searchInDir(dir, query) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fullPath = path.join(dir, f);
    if (fs.statSync(fullPath).isDirectory()) {
      searchInDir(fullPath, query);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes(query.toLowerCase())) {
        console.log(`Match in ${fullPath}:`);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(query.toLowerCase())) {
            console.log(`  L${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchInDir(path.join(__dirname, '../components'), 'bento');
searchInDir(path.join(__dirname, '../components'), 'receta');