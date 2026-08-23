const fs = require("fs");
const content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
const lines = content.split("\n");
lines.forEach((line, i) => {
  if (line.includes("\`") || line.includes("select(")) {
    console.log((i) + ": " + line);
  }
});
