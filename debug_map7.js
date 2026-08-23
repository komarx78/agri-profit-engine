const fs = require("fs");
const content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
const matchIdx = content.indexOf(".select(`\n          id,");
console.log(content.substring(0, matchIdx).match(/\`/g).length);
