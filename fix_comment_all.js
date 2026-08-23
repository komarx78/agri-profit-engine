const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
const lines = content.split("\n");
const keywords = ["const", "let", "var", "function", "if", "for", "while", "return", "try", "catch", "switch", "class"];

const newLines = lines.map(line => {
  let matched = false;
  if (line.includes("//")) {
    for (let kw of keywords) {
      const regex = new RegExp(`(//[^\n]*?)\\s+(${kw}\\b.*)`);
      if (regex.test(line)) {
        line = line.replace(regex, "$1\n  $2");
        matched = true;
        break;
      }
    }
  }
  return line;
});

fs.writeFileSync("src/app/admin/map/page.tsx", newLines.join("\n"), "utf-8");
console.log("done");
