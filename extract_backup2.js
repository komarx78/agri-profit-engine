const fs = require("fs");
const lines = fs.readFileSync("C:\\Users\\komai\\.gemini\\antigravity\\brain\\0a48594a-c289-45a0-847b-426c0fe57f4e\\.system_generated\\logs\\transcript_full.jsonl", "utf-8").split("\n");

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("view_file") && lines[i].includes("src/app/admin/map/page.tsx")) {
    console.log("View file call at " + i);
  }
  if (lines[i].includes('"type":"GENERIC"') && lines[i].includes('import { GoogleMap, useJsApiLoader, Polygon, InfoWindow } from')) {
    console.log("Found source code at " + i);
    const obj = JSON.parse(lines[i]);
    fs.writeFileSync("backup_page.tsx", obj.content, "utf-8");
    console.log("Saved backup_page.tsx");
    break;
  }
}
console.log("done");
