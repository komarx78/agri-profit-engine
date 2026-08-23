const fs = require("fs");
const content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
const lines = content.split("\n");
let inStr = false;
lines.forEach((line, i) => {
  let matches = line.match(/\`/g);
  if (matches) {
    inStr = (matches.length % 2 === 1) ? !inStr : inStr;
    console.log(`Line ${i}: count=${matches.length}, inStr=${inStr}`);
    console.log(line);
  }
});
