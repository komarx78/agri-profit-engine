const fs = require("fs");
const lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");
const target = lines[130];
console.log(target);
for(let i=0; i<target.length; i++) {
  console.log(target[i] + " : " + target.charCodeAt(i).toString(16));
}
