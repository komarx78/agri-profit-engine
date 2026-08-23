const fs = require("fs");
const content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
const lines = content.split("\n");
for(let i=35; i<45; i++) {
  console.log(i + ": " + lines[i]);
}
