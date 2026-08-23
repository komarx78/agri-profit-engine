const fs = require("fs");

function searchDeep(obj, results) {
  if (typeof obj === 'string') {
    if (obj.length > 2000 && obj.includes("handleSavePolygon") && obj.includes("import React")) {
      results.push(obj);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach(item => searchDeep(item, results));
  } else if (obj !== null && typeof obj === 'object') {
    Object.values(obj).forEach(val => searchDeep(val, results));
  }
}

const lines = fs.readFileSync("C:\\Users\\komai\\.gemini\\antigravity\\brain\\0a48594a-c289-45a0-847b-426c0fe57f4e\\.system_generated\\logs\\transcript_full.jsonl", "utf-8").split("\n");

let foundCount = 0;
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  try {
    const obj = JSON.parse(lines[i]);
    const results = [];
    searchDeep(obj, results);
    if (results.length > 0) {
      fs.writeFileSync(`recovered_${foundCount}.tsx`, results[0], "utf-8");
      console.log(`Found and saved to recovered_${foundCount}.tsx from line ${i}`);
      foundCount++;
    }
  } catch(e) {}
}
console.log("done");
