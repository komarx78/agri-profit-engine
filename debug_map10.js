const fs = require("fs");
const content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
const lines = content.split("\n");
lines.forEach((line, i) => {
  if (line.includes("//") && line.match(/\/\/[^\n]*?(const|let|var|function|if|return) /)) {
    console.log(i + ": " + line);
  }
});
