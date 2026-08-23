const fs = require("fs");
const path = require("path");

function searchDeep(obj, results) {
  if (typeof obj === 'string') {
    if (obj.length > 10000 && obj.includes("handleSavePolygon") && obj.includes("import React")) {
      results.push(obj);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach(item => searchDeep(item, results));
  } else if (obj !== null && typeof obj === 'object') {
    Object.values(obj).forEach(val => searchDeep(val, results));
  }
}

const brainDir = "C:\\Users\\komai\\.gemini\\antigravity\\brain";
const dirs = fs.readdirSync(brainDir);

let foundCount = 0;
for (const d of dirs) {
  const p = path.join(brainDir, d, ".system_generated", "logs", "transcript_full.jsonl");
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      try {
        const obj = JSON.parse(lines[i]);
        const results = [];
        searchDeep(obj, results);
        if (results.length > 0) {
          fs.writeFileSync(`recovered_old_${d.substring(0,8)}_${foundCount}.tsx`, results[0], "utf-8");
          console.log(`Found in session ${d} at line ${i}`);
          foundCount++;
        }
      } catch(e) {}
    }
  }
}
console.log("Total found: " + foundCount);
