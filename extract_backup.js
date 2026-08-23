const fs = require("fs");
const lines = fs.readFileSync("C:\\Users\\komai\\.gemini\\antigravity\\brain\\0a48594a-c289-45a0-847b-426c0fe57f4e\\.system_generated\\logs\\transcript_full.jsonl", "utf-8").split("\n");

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("view_file") && lines[i].includes("src/app/admin/map/page.tsx") && lines[i].includes("content")) {
    // ツール実行結果のログを探す
    const obj = JSON.parse(lines[i]);
    if (obj.type === "SYSTEM_MESSAGE" && obj.content && obj.content.includes("File Content:")) {
      console.log("Found backup at line " + i);
      const match = obj.content.match(/File Content:\n([\s\S]+?)\n\n\n<\/SYSTEM_MESSAGE>/);
      if (match) {
        fs.writeFileSync("backup_page.tsx", match[1], "utf-8");
        console.log("Extracted to backup_page.tsx");
        break;
      }
    }
  }
}
console.log("done");
