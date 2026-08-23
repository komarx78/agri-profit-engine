const fs = require("fs");
const content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
const matches = content.match(/\`/g);
console.log("Backticks count:", matches ? matches.length : 0);
