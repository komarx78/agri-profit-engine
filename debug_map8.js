const fs = require("fs");
const content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
const matchIdx = content.indexOf(".select(`\n          id,");
const sub = content.substring(0, matchIdx);
const lines = sub.split("\n");
lines.forEach((line, i) => {
  if (line.includes("\`")) {
    console.log(i + ": " + line);
  }
});
